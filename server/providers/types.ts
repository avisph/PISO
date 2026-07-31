import type { ChatEvent, ChatRequest, Draft } from '../../shared/chat'

/**
 * A chat provider streams Bes's reply as events. Whoever answers — Claude,
 * Ollama, or the canned library — produces the same `ChatEvent`s, so the UI
 * never learns which one it was talking to.
 */
export interface Provider {
  /** Stable id, surfaced in /api/chat/status. */
  id: 'anthropic' | 'ollama' | 'offline'
  /** Model actually being asked. */
  model: string
  /** Where requests go — shown in logs and status so misconfig is obvious. */
  endpoint?: string
  /** False when the provider has no credentials or no reachable host. */
  available: boolean
  /** Human-readable reason when `available` is false. */
  reason?: string
  stream(request: ChatRequest, send: (event: ChatEvent) => void): Promise<void>
}

/** Validate model-supplied tool input before it reaches the confirm card. */
export function coerceDraft(input: unknown): Draft | null {
  if (!input || typeof input !== 'object') return null
  const raw = input as Record<string, unknown>

  const kind = raw.kind
  if (kind !== 'expense' && kind !== 'income' && kind !== 'transfer' && kind !== 'debt_payment') {
    return null
  }

  // Models reach for JSON numbers even when told not to — accept both, then
  // normalise to the decimal string the rest of the app expects.
  const rawAmount =
    typeof raw.amount === 'string'
      ? raw.amount
      : typeof raw.amount === 'number'
        ? raw.amount.toFixed(2)
        : ''
  const amount = rawAmount.replace(/[,₱\s]/g, '')
  if (!/^\d+(\.\d{1,2})?$/.test(amount)) return null

  const str = (value: unknown) => (typeof value === 'string' && value ? value : undefined)

  return {
    kind,
    amount,
    categoryId: str(raw.categoryId),
    merchant: str(raw.merchant),
    accountId: str(raw.accountId),
    debtId: str(raw.debtId),
    date: str(raw.date),
    note: str(raw.note),
  }
}
