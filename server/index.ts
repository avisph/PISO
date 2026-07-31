import { createServer } from 'node:http'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import fs from 'node:fs'
import express from 'express'
import type { ChatRequest, ChatStatus } from '../shared/chat'
import { offlineReply } from './offline'
import type { Provider } from './providers/types'
import { createAnthropicProvider } from './providers/anthropic'
import { createOllamaProvider, probeOllama } from './providers/ollama'

const PORT = Number(process.env.PORT ?? 8787)
const DIRNAME = path.dirname(fileURLToPath(import.meta.url))
const DIST = path.resolve(DIRNAME, '../dist')

/**
 * The AI never touches the database and the key never touches the client
 * (blueprint §7). This route builds a bounded snapshot, sends it out, and
 * validates what comes back before the UI ever sees it.
 *
 * Which model answers is a deployment choice: PISO_AI_PROVIDER=ollama|anthropic,
 * or `auto` (the default), which prefers Ollama when it is configured and falls
 * back to Claude, then to the canned library.
 */

const requested = (process.env.PISO_AI_PROVIDER ?? 'auto').toLowerCase()
const ollamaConfigured = Boolean(process.env.OLLAMA_API_KEY || process.env.OLLAMA_HOST)

function selectProvider(): Provider | null {
  if (requested === 'ollama') return createOllamaProvider()
  if (requested === 'anthropic') {
    const anthropic = createAnthropicProvider()
    return anthropic.available ? anthropic : null
  }
  if (requested === 'offline') return null

  // auto
  if (ollamaConfigured) return createOllamaProvider()
  const anthropic = createAnthropicProvider()
  return anthropic.available ? anthropic : null
}

const provider = selectProvider()
let providerNote = provider?.reason ?? ''
// Flipped false when the startup probe says the host or model is wrong, so the
// chat screen can say so instead of failing on the first message.
let providerHealthy = true

const app = express()
app.use(express.json({ limit: '256kb' }))

app.get('/api/health', (_req, res) => {
  res.json({ ok: true })
})

app.get('/api/chat/status', (_req, res) => {
  const status: ChatStatus = {
    live: Boolean(provider?.available) && providerHealthy,
    model: provider?.model ?? 'canned response library',
    provider: provider?.id ?? 'offline',
    endpoint: provider?.endpoint,
    note: providerNote || undefined,
  }
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

  const send = (event: Parameters<Provider['stream']>[1] extends (e: infer E) => void ? E : never) => {
    res.write(`data: ${JSON.stringify(event)}\n\n`)
  }

  if (!provider) {
    // No provider configured: fall back to the canned Taglish library so the
    // screen still demonstrates the interaction, and say so plainly.
    for (const event of offlineReply(body)) send(event)
    send({ type: 'done' })
    res.end()
    return
  }

  try {
    await provider.stream(body, send)
  } catch (error) {
    console.error(`[chat:${provider.id}]`, error)
    send({
      type: 'error',
      message:
        error instanceof Error
          ? `${provider.id} error — ${error.message}`
          : `Could not reach ${provider.id} just now.`,
    })
  }

  send({ type: 'done' })
  res.end()
})

// Serve the built app in production; in dev, Vite serves the client and
// proxies /api here.
if (fs.existsSync(DIST)) {
  app.use(express.static(DIST))
  app.get('*', (_req, res) => res.sendFile(path.join(DIST, 'index.html')))
}

createServer(app).listen(PORT, async () => {
  if (!provider) {
    console.log(
      `piso api on http://localhost:${PORT} — chat is offline (no provider configured; using the canned library)`,
    )
    return
  }

  console.log(
    `piso api on http://localhost:${PORT} — chat via ${provider.id} (${provider.model}) at ${provider.endpoint}`,
  )

  // A wrong model name or an unreachable host is the usual Ollama snag; report
  // it at startup instead of on the user's first message.
  if (provider.id === 'ollama') {
    const probe = await probeOllama()
    providerHealthy = probe.ok
    providerNote = probe.detail
    console.log(probe.ok ? `  ✓ ${probe.detail}` : `  ! ${probe.detail}`)
  }
})
