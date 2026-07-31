import { useEffect, useRef, useState } from 'react'
import { useStore } from '../state/store'
import type { ChatEvent, ChatRequest, ChatStatus, ChatTurn, Draft } from '../../shared/chat'
import { buildContext, describeDraft } from '../lib/chatContext'
import { formatMoney } from '../lib/money'
import { formatTime, toISO, today } from '../lib/dates'
import { PERSONALITIES } from './Onboarding'
import { mentionsAmount, offlineReply } from '../../shared/offline'

const SUGGESTIONS = ["What's due soon?", 'Where did my money go?', 'Plan my salary']

/**
 * Where the API lives. Empty means same origin, which is right in dev and when
 * the built app is served by its own server. Installed on a phone there is no
 * server at all, so Settings lets you point at the PC on your wifi.
 */
const apiBase = (server: string | undefined) => (server ? server.replace(/\/+$/, '') : '')

/**
 * Models like to hand back their whole reply wrapped in quotation marks, as
 * if reciting it. The bubble already reads as speech, so a pair of quotes
 * around all of it just looks like a bug.
 */
function unquote(text: string): string {
  const trimmed = text.trim()
  const pairs: [string, string][] = [
    ['"', '"'],
    ['“', '”'],
    ["'", "'"],
  ]
  for (const [open, close] of pairs) {
    if (trimmed.length > 1 && trimmed.startsWith(open) && trimmed.endsWith(close)) {
      const inner = trimmed.slice(1, -1)
      // Only when the quotes wrap everything — not when Bes is quoting you.
      if (!inner.includes(close)) return inner
    }
  }
  return text
}

/**
 * 1f — Bes. Q&A over the finance snapshot, plus the parse-draft confirm card:
 * Bes never writes to the ledger, she drafts and the user confirms.
 */
export function Chat() {
  const [data, dispatch] = useStore()
  const [turns, setTurns] = useState<ChatTurn[]>([])
  const [input, setInput] = useState('')
  const [pending, setPending] = useState(false)
  const [streamed, setStreamed] = useState('')
  const [status, setStatus] = useState<ChatStatus | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [handledDrafts, setHandledDrafts] = useState<Record<string, 'confirmed' | 'discarded'>>({})
  const logRef = useRef<HTMLDivElement>(null)
  const startedAt = useRef(new Date())

  const personality = PERSONALITIES.find((p) => p.key === data.profile.personality)

  useEffect(() => {
    fetch(`${apiBase(data.profile.besServer)}/api/chat/status`)
      .then((r) => r.json())
      .then((s: ChatStatus) => setStatus({ serverReachable: true, ...s }))
      .catch(() =>
        setStatus({
          serverReachable: false,
          live: false,
          model: 'canned response library',
          provider: 'offline',
        }),
      )
  }, [data.profile.besServer])

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: 'smooth' })
  }, [turns, streamed, pending])

  async function send(text: string) {
    const trimmed = text.trim()
    if (!trimmed || pending) return

    const nextTurns: ChatTurn[] = [...turns, { role: 'user', text: trimmed }]
    setTurns(nextTurns)
    setInput('')
    setPending(true)
    setStreamed('')
    setError(null)

    const request = { turns: nextTurns, context: buildContext(data) }

    try {
      let response: Response
      try {
        response = await fetch(`${apiBase(data.profile.besServer)}/api/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(request),
        })
      } catch {
        // No server at all — the normal case for the installed app away from
        // home. Answer here rather than showing an error: the canned library
        // is the same one the server would have used, and the notice above the
        // composer already says a model is not answering.
        answerLocally(request)
        return
      }

      if (!response.ok || !response.body) {
        if (response.status === 429) throw new Error('slow down a sec.')
        answerLocally(request)
        return
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let assembled = ''
      let draft: Draft | undefined
      let toolUseId: string | undefined

      // The route streams `data: {...}` frames, one JSON event per frame.
      for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })

        const frames = buffer.split('\n\n')
        buffer = frames.pop() ?? ''

        for (const frame of frames) {
          const line = frame.replace(/^data: /, '').trim()
          if (!line) continue
          const event = JSON.parse(line) as ChatEvent
          if (event.type === 'text') {
            assembled += event.text
            setStreamed(assembled)
          } else if (event.type === 'draft') {
            draft = event.draft
            toolUseId = event.toolUseId
          } else if (event.type === 'error') {
            setError(event.message)
          }
        }
      }

      setTurns((current) => [
        ...current,
        { role: 'assistant', text: assembled.trim(), draft, toolUseId },
      ])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong reaching Bes.')
    } finally {
      setStreamed('')
      setPending(false)
    }
  }

  /** The canned library, run in the browser. Same events, same draft rules. */
  function answerLocally(request: ChatRequest) {
    const mayDraft = mentionsAmount(
      [...request.turns].reverse().find((t) => t.role === 'user')?.text ?? '',
    )
    let assembled = ''
    let draft: Draft | undefined
    let toolUseId: string | undefined

    for (const event of offlineReply(request)) {
      if (event.type === 'text') assembled += event.text
      if (event.type === 'draft' && mayDraft && !draft) {
        draft = event.draft
        toolUseId = event.toolUseId
      }
    }

    setTurns((current) => [
      ...current,
      { role: 'assistant', text: assembled.trim(), draft, toolUseId },
    ])
    setStatus((current) => ({
      serverReachable: current?.serverReachable ?? false,
      live: false,
      model: 'canned response library',
      provider: 'offline',
    }))
    setStreamed('')
    setPending(false)
  }

  function resolveDraft(draft: Draft, toolUseId: string, outcome: 'confirmed' | 'discarded') {
    if (outcome === 'confirmed') {
      // A model can name an account that doesn't exist, and the offline parser
      // used to hardcode one. The reducer moves no balance for an unknown id,
      // so the entry would land in the list with your cash untouched — check
      // both ids against the ledger before writing.
      const known = (id: string | undefined) =>
        id && data.accounts.some((a) => a.id === id) ? id : undefined
      const accountId =
        known(draft.accountId) ??
        data.accounts.find((a) => a.type !== 'credit' && a.type !== 'savings')?.id ??
        data.accounts[0]?.id ??
        ''
      const categoryId = data.categories.some((c) => c.id === draft.categoryId)
        ? draft.categoryId
        : data.categories.find((c) => c.kind === (draft.kind === 'income' ? 'income' : 'expense'))
            ?.id

      dispatch({
        type: 'transaction/add',
        transaction: {
          kind: draft.kind,
          amount: Math.round(Number(draft.amount) * 100),
          categoryId,
          accountId,
          debtId: draft.debtId,
          merchant: draft.merchant,
          note: draft.note,
          date: toISO(today()),
          source: 'chat',
        },
      })
    }

    setHandledDrafts((current) => ({ ...current, [toolUseId]: outcome }))
    setTurns((current) => [
      ...current,
      { role: 'tool_result', toolUseId, result: describeDraft(data, draft, outcome) },
    ])
  }

  return (
    <div className="chat">
      <header className="chat__head rule-fade">
        <span className="chat__avatar" aria-hidden="true">
          ✦
        </span>
        <div className="stack">
          <span className="chat__name">Bes</span>
          <span className="chat__tagline">financially practical, hindi financially licensed</span>
        </div>
        <span className="chip chip--accent" style={{ marginLeft: 'auto', padding: '3px 9px' }}>
          {personality?.name}
        </span>
      </header>

      <div className="chat__log" ref={logRef}>
        <div className="chat__stamp">Today, {formatTime(startedAt.current)}</div>

        {turns.length === 0 && !pending && (
          <div className="bubble-bes">
            hi {data.profile.name}. ask me anything about your money, or just tell me what you
            spent and i'll draft it. try: “spent 350 on grab kanina”.
          </div>
        )}

        {turns.map((turn, index) => {
          if (turn.role === 'user') {
            return (
              <div key={index} className="bubble-user">
                {turn.text}
              </div>
            )
          }

          if (turn.role === 'tool_result') return null

          const outcome = turn.toolUseId ? handledDrafts[turn.toolUseId] : undefined

          return (
            <div key={index} style={{ display: 'contents' }}>
              {turn.text && <div className="bubble-bes">{unquote(turn.text)}</div>}

              {turn.draft && turn.toolUseId && !outcome && (
                <DraftCard
                  draft={turn.draft}
                  categoryName={
                    data.categories.find((c) => c.id === turn.draft?.categoryId)?.name
                  }
                  categoryEmoji={
                    data.categories.find((c) => c.id === turn.draft?.categoryId)?.emoji
                  }
                  accountName={data.accounts.find((a) => a.id === turn.draft?.accountId)?.name}
                  onConfirm={() => resolveDraft(turn.draft!, turn.toolUseId!, 'confirmed')}
                  onDiscard={() => resolveDraft(turn.draft!, turn.toolUseId!, 'discarded')}
                />
              )}

              {turn.draft && outcome && (
                <div className="bubble-aside">
                  {outcome === 'confirmed'
                    ? `Saved — ${formatMoney(Math.round(Number(turn.draft.amount) * 100))}. Nasa ledger mo na.`
                    : 'Sige, hindi ko na sinave.'}
                </div>
              )}
            </div>
          )
        })}

        {pending && (
          <div className="bubble-bes">
            {streamed || (
              <span className="typing" aria-label="Bes is typing">
                <span />
                <span />
                <span />
              </span>
            )}
          </div>
        )}

        {error && <div className="bubble-aside danger">{error}</div>}
      </div>

      <div className="chat__foot">
        {status && !status.live && (
          <div className="chat__notice">
            {status.serverReachable === false ? (
              <>
                Walang server na naaabot, kaya dito sa telepono mismo sumasagot si Bes mula sa
                canned library. Tuloy pa rin ang lahat — nasa device ang ledger mo. Para sa
                totoong model: buksan ang Piso sa PC mo, tapos ilagay ang address niya sa{' '}
                <b>Settings → Bes</b>.
              </>
            ) : status.provider === 'offline' ? (
              <>
                Offline mode — no model configured on the server, so Bes is answering from the
                canned library. Point <code>OLLAMA_HOST</code> in <code>.env</code> at your Ollama
                (run <code>npm run ai:check</code> to find it), then restart. A hosted key —{' '}
                <code>OLLAMA_API_KEY</code> or <code>ANTHROPIC_API_KEY</code> — works too.
              </>
            ) : (
              <>
                {status.provider} isn't answering, so Bes is falling back to the canned library.
                {status.note ? ` ${status.note}` : ''}
              </>
            )}
          </div>
        )}

        <div className="chat__suggestions">
          {SUGGESTIONS.map((s) => (
            <button key={s} type="button" className="pill" onClick={() => send(s)} disabled={pending}>
              {s}
            </button>
          ))}
        </div>

        <form
          className="composer"
          onSubmit={(e) => {
            e.preventDefault()
            send(input)
          }}
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask or log anything…"
            aria-label="Message Bes"
            autoComplete="off"
          />
          <button
            type="submit"
            className="composer__send"
            disabled={pending || !input.trim()}
            aria-label="Send"
          >
            ➤
          </button>
        </form>
      </div>
    </div>
  )
}

function DraftCard({
  draft,
  categoryName,
  categoryEmoji,
  accountName,
  onConfirm,
  onDiscard,
}: {
  draft: Draft
  categoryName?: string
  categoryEmoji?: string
  accountName?: string
  onConfirm: () => void
  onDiscard: () => void
}) {
  const label =
    draft.kind === 'expense'
      ? 'Expense'
      : draft.kind === 'income'
        ? 'Income'
        : draft.kind === 'transfer'
          ? 'Transfer'
          : 'Debt payment'

  const tags = [
    categoryName ? `${categoryEmoji ?? ''} ${categoryName}`.trim() : null,
    draft.merchant,
    accountName,
    draft.date ?? 'today',
  ].filter(Boolean) as string[]

  return (
    <div className="draft-card">
      <div className="draft-card__kicker">Draft — confirm to save</div>
      <div className="draft-card__amount">
        <span className="muted">{label}</span>
        <b>{formatMoney(Math.round(Number(draft.amount) * 100), { decimals: true })}</b>
      </div>
      <div className="draft-card__tags">
        {tags.map((tag) => (
          <span key={tag} className="tag">
            {tag}
          </span>
        ))}
      </div>
      <div className="draft-card__actions">
        <button type="button" className="draft-card__confirm" onClick={onConfirm}>
          Confirm
        </button>
        <button type="button" className="draft-card__ghost" onClick={onDiscard}>
          Edit
        </button>
        <button type="button" className="draft-card__ghost" onClick={onDiscard} aria-label="Discard">
          ✕
        </button>
      </div>
    </div>
  )
}
