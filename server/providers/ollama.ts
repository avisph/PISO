import type { ChatEvent, ChatRequest, ChatTurn } from '../../shared/chat'
import { BES_PERSONA, DRAFT_TOOL, contextBlock } from '../bes'
import { parseDraft } from '../../shared/offline'
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
 * Strips the model's own markup out of a token stream.
 *
 * Two things leak into `content` on local models. Reasoning models (qwen3,
 * deepseek-r1) narrate inside `<think>…</think>` before they answer. And when
 * a build's tool template misfires, the tool call itself arrives as *text* —
 * qwen3 emits a `<tools>` or `<tool_call>` block of raw JSON — instead of as a
 * structured `message.tool_calls`. Neither belongs in a chat bubble.
 *
 * What is stripped is also captured, so a tool call that came through as text
 * can still become a draft card rather than being thrown away.
 *
 * The tags arrive split across chunks, so this holds back any trailing text
 * that could still turn out to be the start of one.
 */
const STRIPPED = [
  { open: '<think>', close: '</think>', keep: false },
  { open: '<tools>', close: '</tools>', keep: true },
  { open: '<tool_call>', close: '</tool_call>', keep: true },
  { open: '<tool_response>', close: '</tool_response>', keep: false },
] as const

export function createThinkFilter() {
  let held = ''
  let inside: (typeof STRIPPED)[number] | null = null
  /** Text captured from `keep` blocks — candidate tool calls. */
  const captured: string[] = []
  let capturing = ''

  /** Longest suffix of `text` that is a proper prefix of `tag`. */
  const danglingPrefix = (text: string, tag: string): number => {
    const max = Math.min(text.length, tag.length - 1)
    for (let n = max; n > 0; n -= 1) {
      if (text.endsWith(tag.slice(0, n))) return n
    }
    return 0
  }

  /** The earliest opening tag in `text`, if any. */
  const nextOpen = (text: string) => {
    let best: { at: number; tag: (typeof STRIPPED)[number] } | null = null
    for (const tag of STRIPPED) {
      const at = text.indexOf(tag.open)
      if (at !== -1 && (!best || at < best.at)) best = { at, tag }
    }
    return best
  }

  /** How much to hold back in case a tag is only half-arrived. */
  const holdBack = (text: string): number => {
    let keep = 0
    for (const tag of STRIPPED) keep = Math.max(keep, danglingPrefix(text, tag.open))
    return keep
  }

  return {
    push(chunk: string): string {
      held += chunk
      let out = ''

      for (;;) {
        if (inside) {
          const end = held.indexOf(inside.close)
          if (end === -1) {
            const keep = danglingPrefix(held, inside.close)
            if (inside.keep) capturing += held.slice(0, held.length - keep)
            held = held.slice(held.length - keep)
            return out
          }
          if (inside.keep) {
            capturing += held.slice(0, end)
            captured.push(capturing)
            capturing = ''
          }
          held = held.slice(end + inside.close.length)
          inside = null
          continue
        }

        const found = nextOpen(held)
        if (!found) {
          const keep = holdBack(held)
          out += held.slice(0, held.length - keep)
          held = held.slice(held.length - keep)
          return out
        }
        out += held.slice(0, found.at)
        held = held.slice(found.at + found.tag.open.length)
        inside = found.tag
      }
    },
    /** Anything still held back at the end was never a tag after all. */
    flush(): string {
      const rest = inside ? '' : held
      held = ''
      return rest
    },
    /** Raw text from `<tools>` / `<tool_call>` blocks, in arrival order. */
    toolText(): string[] {
      return captured
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

      // At most one card per reply: the UI shows a single draft, and a model
      // that emits three has invented at least two of them.
      const emitDraft = (draft: ReturnType<typeof coerceDraft>) => {
        if (drafted || !draft) return
        drafted = true
        send({ type: 'draft', draft, toolUseId: `ollama-${Date.now()}` })
      }

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
            emitDraft(coerceDraft(normaliseArguments(call.function.arguments)))
          }
        }
      }

      const tail = think.flush()
      if (tail) {
        assembled += tail
        send({ type: 'text', text: tail })
      }

      // A tool call that arrived as text rather than as `message.tool_calls`.
      // The filter kept the block out of the bubble; this is where it becomes
      // a real draft instead of being discarded.
      if (!drafted) {
        for (const block of think.toolText()) {
          for (const call of extractToolCalls(block)) {
            if (call.name && call.name !== DRAFT_TOOL.name) continue
            emitDraft(coerceDraft(call.arguments))
            if (drafted) break
          }
          if (drafted) break
        }
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

/**
 * Pulls tool calls out of a text block a model emitted instead of calling the
 * tool properly. The shapes seen in the wild are `{"name":…,"arguments":{…}}`,
 * a bare arguments object, and several of either concatenated with no
 * separator — so this scans for balanced top-level JSON objects rather than
 * trying to parse the block as a whole.
 */
function extractToolCalls(block: string): { name?: string; arguments: unknown }[] {
  const out: { name?: string; arguments: unknown }[] = []
  let depth = 0
  let start = -1
  let inString = false
  let escaped = false

  for (let i = 0; i < block.length; i += 1) {
    const c = block[i]
    if (inString) {
      if (escaped) escaped = false
      else if (c === '\\') escaped = true
      else if (c === '"') inString = false
      continue
    }
    if (c === '"') inString = true
    else if (c === '{') {
      if (depth === 0) start = i
      depth += 1
    } else if (c === '}') {
      depth -= 1
      if (depth === 0 && start !== -1) {
        try {
          const parsed = JSON.parse(block.slice(start, i + 1)) as Record<string, unknown>
          out.push(
            'arguments' in parsed
              ? { name: parsed.name as string | undefined, arguments: normaliseArguments(parsed.arguments) }
              : { arguments: parsed },
          )
        } catch {
          // Not JSON after all — the model was talking.
        }
        start = -1
      }
      if (depth < 0) depth = 0
    }
  }
  return out
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
