import type { ChatEvent, ChatRequest, ChatTurn } from '../../shared/chat'
import { BES_PERSONA, DRAFT_TOOL, contextBlock } from '../bes'
import { parseDraft } from '../offline'
import { coerceDraft, type Provider } from './types'

/**
 * Ollama — local (`http://localhost:11434`) or Ollama Cloud
 * (`https://ollama.com`, which needs the API key). Uses the native
 * `/api/chat` endpoint: NDJSON streaming, and tool calls arrive as structured
 * `message.tool_calls` rather than as text to be scraped.
 */

const API_KEY = process.env.OLLAMA_API_KEY ?? ''

/**
 * An explicit OLLAMA_HOST always wins — that is the self-hosted case (the same
 * base URL you would put in an n8n Ollama credential). A key with no host means
 * Ollama Cloud.
 */
const HOST = (
  process.env.OLLAMA_HOST ?? (API_KEY ? 'https://ollama.com' : 'http://localhost:11434')
).replace(/\/+$/, '')

const isCloud = /(^|\.)ollama\.com$/i.test(new URL(HOST).hostname)
const MODEL = process.env.OLLAMA_MODEL ?? (isCloud ? 'gpt-oss:120b' : 'llama3.1:8b')

interface OllamaMessage {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content: string
  /** Recent builds split reasoning out of `content`; we never show it. */
  thinking?: string
  tool_calls?: { function: { name: string; arguments: Record<string, unknown> } }[]
  tool_name?: string
}

/**
 * Strips `<think>…</think>` out of a token stream.
 *
 * Reasoning models (qwen3, deepseek-r1, and anything hybrid) narrate before
 * they answer. Newer Ollama builds move that into `message.thinking`, but
 * older ones leave the tags inline in `content` — and either way it must not
 * reach the chat bubble, where it reads as Bes thinking out loud at you.
 *
 * The tags arrive split across chunks, so this holds back any trailing text
 * that could still turn out to be the start of one.
 */
export function createThinkFilter() {
  const OPEN = '<think>'
  const CLOSE = '</think>'
  let held = ''
  let inside = false

  /** Longest suffix of `text` that is a proper prefix of `tag`. */
  const danglingPrefix = (text: string, tag: string): number => {
    const max = Math.min(text.length, tag.length - 1)
    for (let n = max; n > 0; n -= 1) {
      if (text.endsWith(tag.slice(0, n))) return n
    }
    return 0
  }

  return {
    push(chunk: string): string {
      held += chunk
      let out = ''

      for (;;) {
        if (inside) {
          const end = held.indexOf(CLOSE)
          if (end === -1) {
            // Keep only what might be a partial closing tag.
            held = held.slice(held.length - danglingPrefix(held, CLOSE))
            return out
          }
          held = held.slice(end + CLOSE.length)
          inside = false
          continue
        }

        const start = held.indexOf(OPEN)
        if (start === -1) {
          const keep = danglingPrefix(held, OPEN)
          out += held.slice(0, held.length - keep)
          held = held.slice(held.length - keep)
          return out
        }
        out += held.slice(0, start)
        held = held.slice(start + OPEN.length)
        inside = true
      }
    },
    /** Anything still held back at the end was never a tag after all. */
    flush(): string {
      const rest = inside ? '' : held
      held = ''
      return rest
    },
  }
}

export function createOllamaProvider(): Provider {
  return {
    id: 'ollama',
    model: MODEL,
    endpoint: HOST,
    // Local Ollama needs no key, so the provider is considered configured
    // whenever it is explicitly selected; reachability is reported by
    // `probeOllama()` at startup and surfaced in the status route.
    available: true,

    async stream(request: ChatRequest, send: (event: ChatEvent) => void) {
      const response = await fetch(`${HOST}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(API_KEY ? { Authorization: `Bearer ${API_KEY}` } : {}),
        },
        body: JSON.stringify({
          model: MODEL,
          stream: true,
          messages: toOllamaMessages(request),
          tools: [
            {
              type: 'function',
              function: {
                name: DRAFT_TOOL.name,
                description: DRAFT_TOOL.description,
                parameters: DRAFT_TOOL.parameters,
              },
            },
          ],
          options: {
            temperature: 0.7,
            num_predict: 800,
            // Ollama defaults to a small context (2–4k depending on build).
            // The persona plus the finance snapshot is ~1k tokens on its own,
            // so a short window silently truncates the numbers Bes is meant to
            // answer from. Raise it; lower via OLLAMA_NUM_CTX if RAM is tight.
            num_ctx: Number(process.env.OLLAMA_NUM_CTX ?? 8192),
          },
        }),
      })

      if (!response.ok || !response.body) {
        const detail = await response.text().catch(() => '')
        throw new Error(
          `Ollama returned ${response.status}${detail ? ` — ${detail.slice(0, 300)}` : ''}`,
        )
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      const think = createThinkFilter()
      let buffer = ''
      let assembled = ''
      let drafted = false

      // /api/chat streams newline-delimited JSON, one object per chunk.
      for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })

        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''

        for (const line of lines) {
          const trimmed = line.trim()
          if (!trimmed) continue

          let chunk: {
            message?: OllamaMessage
            error?: string
            done?: boolean
          }
          try {
            chunk = JSON.parse(trimmed)
          } catch {
            continue
          }

          if (chunk.error) throw new Error(chunk.error)

          // `message.thinking` is deliberately ignored — that is the model's
          // reasoning, not its answer.
          const raw = chunk.message?.content
          if (raw) {
            const text = think.push(raw)
            if (text) {
              assembled += text
              send({ type: 'text', text })
            }
          }

          for (const call of chunk.message?.tool_calls ?? []) {
            if (call.function?.name !== DRAFT_TOOL.name) continue
            const draft = coerceDraft(normaliseArguments(call.function.arguments))
            if (draft) {
              drafted = true
              send({ type: 'draft', draft, toolUseId: `ollama-${Date.now()}` })
            }
          }
        }
      }

      const tail = think.flush()
      if (tail) {
        assembled += tail
        send({ type: 'text', text: tail })
      }

      // Smaller models often narrate a transaction instead of calling the tool.
      // Rather than lose the draft card, fall back to the local parser — the
      // user still confirms before anything is written.
      if (!drafted) {
        const lastUser = [...request.turns].reverse().find((t) => t.role === 'user')
        const fallback = lastUser?.role === 'user' ? parseDraft(lastUser.text) : null
        if (fallback) send({ type: 'draft', draft: fallback, toolUseId: `parsed-${Date.now()}` })
      }

      if (!assembled.trim() && !drafted) {
        send({
          type: 'error',
          message: `${MODEL} returned nothing. Try a different model with OLLAMA_MODEL.`,
        })
      }
    },
  }
}

/** Some builds hand back the arguments object as a JSON string. */
function normaliseArguments(args: unknown): unknown {
  if (typeof args === 'string') {
    try {
      return JSON.parse(args)
    } catch {
      return null
    }
  }
  return args
}

function toOllamaMessages(request: ChatRequest): OllamaMessage[] {
  const messages: OllamaMessage[] = [
    { role: 'system', content: `${BES_PERSONA}\n\n${contextBlock(request.context)}` },
  ]

  request.turns.forEach((turn: ChatTurn) => {
    if (turn.role === 'user') {
      messages.push({ role: 'user', content: turn.text })
      return
    }

    if (turn.role === 'assistant') {
      messages.push({
        role: 'assistant',
        content: turn.text,
        ...(turn.draft
          ? {
              tool_calls: [
                {
                  function: {
                    name: DRAFT_TOOL.name,
                    arguments: turn.draft as unknown as Record<string, unknown>,
                  },
                },
              ],
            }
          : {}),
      })
      return
    }

    messages.push({ role: 'tool', tool_name: DRAFT_TOOL.name, content: turn.result })
  })

  return messages
}

/**
 * Startup check: is the host reachable, and does it actually have the model?
 * A wrong model name is the most common Ollama misconfiguration, and it is
 * much friendlier to say so up front than to fail on the first message.
 */
export async function probeOllama(): Promise<{ ok: boolean; detail: string }> {
  try {
    const response = await fetch(`${HOST}/api/tags`, {
      headers: API_KEY ? { Authorization: `Bearer ${API_KEY}` } : {},
      signal: AbortSignal.timeout(5_000),
    })

    if (!response.ok) {
      return { ok: false, detail: `${HOST} answered ${response.status}` }
    }

    const body = (await response.json()) as { models?: { name?: string; model?: string }[] }
    const names = (body.models ?? []).map((m) => m.name ?? m.model ?? '').filter(Boolean)

    // Cloud hosts don't always enumerate models; an empty list isn't an error.
    if (names.length === 0) return { ok: true, detail: `${HOST} reachable` }

    const has = names.some((n) => n === MODEL || n.replace(/:latest$/, '') === MODEL)
    return has
      ? { ok: true, detail: `${HOST} has ${MODEL}` }
      : {
          ok: false,
          detail: `${HOST} is up but has no "${MODEL}". Available: ${names.slice(0, 6).join(', ')}${
            names.length > 6 ? '…' : ''
          }`,
        }
  } catch (error) {
    return {
      ok: false,
      detail: `cannot reach ${HOST} — ${error instanceof Error ? error.message : 'unknown error'}`,
    }
  }
}
