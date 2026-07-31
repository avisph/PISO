import { useEffect, useRef, useState } from 'react'
import { useStore } from '../state/store'
import type { ChatEvent, ChatStatus, ChatTurn, Draft } from '../../shared/chat'
import { buildContext, describeDraft } from '../lib/chatContext'
import { formatMoney } from '../lib/money'
import { formatTime, toISO, today } from '../lib/dates'
import { PERSONALITIES } from './Onboarding'

const SUGGESTIONS = ["What's due soon?", 'Where did my money go?', 'Plan my salary']

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
    fetch('/api/chat/status')
      .then((r) => r.json())
      .then(setStatus)
      .catch(() => setStatus({ live: false, model: 'unavailable', provider: 'offline' }))
  }, [])

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

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ turns: nextTurns, context: buildContext(data) }),
      })

      if (!response.ok || !response.body) {
        throw new Error(response.status === 429 ? 'Slow down a bit, bes.' : 'Bes is unreachable.')
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

  function resolveDraft(draft: Draft, toolUseId: string, outcome: 'confirmed' | 'discarded') {
    if (outcome === 'confirmed') {
      dispatch({
        type: 'transaction/add',
        transaction: {
          kind: draft.kind,
          amount: Math.round(Number(draft.amount) * 100),
          categoryId: draft.categoryId,
          accountId: draft.accountId ?? 'gcash',
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
            Hoy {data.profile.name}! Ask me anything about your money — or just tell me what you
            spent and I'll draft it for you. Try: “spent 350 on grab kanina”.
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
              {turn.text && <div className="bubble-bes">{turn.text}</div>}

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
            {status.provider === 'offline' ? (
              <>
                Offline mode — no model configured on the server, so Bes is answering from the
                canned library. Set <code>OLLAMA_API_KEY</code> (or{' '}
                <code>ANTHROPIC_API_KEY</code>) and restart to talk to a real model.
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
