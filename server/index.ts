import { createServer } from 'node:http'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import fs from 'node:fs'
import express from 'express'
import Anthropic from '@anthropic-ai/sdk'
import type { ChatEvent, ChatRequest, ChatStatus, ChatTurn, Draft } from '../shared/chat'
import { BES_PERSONA, DRAFT_TOOL, contextBlock } from './bes'
import { offlineReply } from './offline'

const PORT = Number(process.env.PORT ?? 8787)
const MODEL = process.env.PISO_MODEL ?? 'claude-opus-5'
const DIRNAME = path.dirname(fileURLToPath(import.meta.url))
const DIST = path.resolve(DIRNAME, '../dist')

/**
 * The AI never touches the database and the key never touches the client
 * (blueprint §7). This route builds a bounded snapshot, sends it out, and
 * validates what comes back before the UI ever sees it.
 */

// A bare client picks up ANTHROPIC_API_KEY, ANTHROPIC_AUTH_TOKEN, or an
// `ant auth login` profile — so "no key in env" doesn't necessarily mean
// "no credentials". We only fall back to the offline library when the SDK
// itself cannot resolve one.
let client: Anthropic | null = null
try {
  client = new Anthropic()
} catch {
  client = null
}
const hasCredentials = Boolean(
  process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN || client?.apiKey,
)

const app = express()
app.use(express.json({ limit: '256kb' }))

app.get('/api/health', (_req, res) => {
  res.json({ ok: true })
})

app.get('/api/chat/status', (_req, res) => {
  const status: ChatStatus = { live: hasCredentials, model: MODEL }
  res.json(status)
})

/** Rough per-IP throttle — the AI route is the only one worth protecting. */
const hits = new Map<string, { count: number; resetAt: number }>()
function rateLimited(ip: string): boolean {
  const now = Date.now()
  const entry = hits.get(ip)
  if (!entry || now > entry.resetAt) {
    hits.set(ip, { count: 1, resetAt: now + 60_000 })
    return false
  }
  entry.count += 1
  return entry.count > 30
}

app.post('/api/chat', async (req, res) => {
  const body = req.body as ChatRequest

  if (!body?.turns?.length || !body.context) {
    res.status(400).json({ error: 'turns and context are required' })
    return
  }

  if (rateLimited(req.ip ?? 'unknown')) {
    res.status(429).json({ error: 'Slow down a bit, bes.' })
    return
  }

  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8')
  res.setHeader('Cache-Control', 'no-cache, no-transform')
  res.setHeader('Connection', 'keep-alive')
  res.flushHeaders?.()

  const send = (event: ChatEvent) => {
    res.write(`data: ${JSON.stringify(event)}\n\n`)
  }

  if (!client || !hasCredentials) {
    // No credentials: fall back to the canned Taglish library so the screen
    // still demonstrates the interaction, and say so plainly.
    for (const event of offlineReply(body)) send(event)
    send({ type: 'done' })
    res.end()
    return
  }

  try {
    const stream = client.messages.stream({
      model: MODEL,
      max_tokens: 1200,
      // Thinking stays on (adaptive) with low effort: on Opus 5 disabling it
      // can make the model write a tool call as plain text instead of calling
      // the tool, which would silently drop the draft card.
      thinking: { type: 'adaptive' },
      output_config: { effort: 'low' },
      system: [
        { type: 'text', text: BES_PERSONA, cache_control: { type: 'ephemeral' } },
        { type: 'text', text: contextBlock(body.context) },
      ],
      tools: [DRAFT_TOOL],
      messages: toAnthropicMessages(body.turns),
    })

    stream.on('text', (delta) => send({ type: 'text', text: delta }))

    const message = await stream.finalMessage()

    if (message.stop_reason === 'refusal') {
      send({
        type: 'error',
        message: 'Bes declined that one. Try asking a different way.',
      })
    }

    for (const block of message.content) {
      if (block.type === 'tool_use' && block.name === 'draft_transaction') {
        const draft = coerceDraft(block.input)
        if (draft) send({ type: 'draft', draft, toolUseId: block.id })
      }
    }
  } catch (error) {
    console.error('[chat]', error)
    const message =
      error instanceof Anthropic.APIError
        ? `Claude said no (${error.status}). ${error.message}`
        : 'Could not reach Claude just now.'
    send({ type: 'error', message })
  }

  send({ type: 'done' })
  res.end()
})

/**
 * Map the visible conversation onto Messages API shapes. Any assistant turn
 * that called the tool must be answered by a tool_result — if the user moved
 * on without confirming, we synthesise one so the request stays valid.
 */
function toAnthropicMessages(turns: ChatTurn[]): Anthropic.MessageParam[] {
  const messages: Anthropic.MessageParam[] = []

  turns.forEach((turn, index) => {
    if (turn.role === 'user') {
      messages.push({ role: 'user', content: turn.text })
      return
    }

    if (turn.role === 'assistant') {
      if (turn.draft && turn.toolUseId) {
        const content: Anthropic.ContentBlockParam[] = []
        if (turn.text.trim()) content.push({ type: 'text', text: turn.text })
        content.push({
          type: 'tool_use',
          id: turn.toolUseId,
          name: 'draft_transaction',
          input: turn.draft as unknown as Record<string, unknown>,
        })
        messages.push({ role: 'assistant', content })

        const answered =
          turns[index + 1]?.role === 'tool_result' &&
          (turns[index + 1] as Extract<ChatTurn, { role: 'tool_result' }>).toolUseId ===
            turn.toolUseId
        if (!answered) {
          messages.push({
            role: 'user',
            content: [
              {
                type: 'tool_result',
                tool_use_id: turn.toolUseId,
                content: 'The draft is still on screen; the user has not confirmed it yet.',
              },
            ],
          })
        }
        return
      }

      if (turn.text.trim()) messages.push({ role: 'assistant', content: turn.text })
      return
    }

    messages.push({
      role: 'user',
      content: [{ type: 'tool_result', tool_use_id: turn.toolUseId, content: turn.result }],
    })
  })

  return messages
}

/** Validate the tool input before it reaches the confirm card. */
function coerceDraft(input: unknown): Draft | null {
  if (!input || typeof input !== 'object') return null
  const raw = input as Record<string, unknown>

  const kind = raw.kind
  if (kind !== 'expense' && kind !== 'income' && kind !== 'transfer' && kind !== 'debt_payment') {
    return null
  }

  const amount = typeof raw.amount === 'string' ? raw.amount : String(raw.amount ?? '')
  if (!/^\d+(\.\d{1,2})?$/.test(amount.replace(/,/g, ''))) return null

  const str = (value: unknown) => (typeof value === 'string' && value ? value : undefined)

  return {
    kind,
    amount: amount.replace(/,/g, ''),
    categoryId: str(raw.categoryId),
    merchant: str(raw.merchant),
    accountId: str(raw.accountId),
    debtId: str(raw.debtId),
    date: str(raw.date),
    note: str(raw.note),
  }
}

// Serve the built app in production; in dev, Vite serves the client and
// proxies /api here.
if (fs.existsSync(DIST)) {
  app.use(express.static(DIST))
  app.get('*', (_req, res) => res.sendFile(path.join(DIST, 'index.html')))
}

createServer(app).listen(PORT, () => {
  console.log(
    `piso api on http://localhost:${PORT} — chat is ${
      hasCredentials ? `live (${MODEL})` : 'offline (no ANTHROPIC_API_KEY; using the canned library)'
    }`,
  )
})
