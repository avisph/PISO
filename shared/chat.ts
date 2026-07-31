/**
 * The wire contract between the Bes chat UI and the /api/chat route.
 * Amounts cross the wire as strings ("350.00") — JSON numbers are floats and
 * are banned for money (blueprint §8).
 */

export type DraftKind = 'expense' | 'income' | 'transfer' | 'debt_payment'

export interface Draft {
  kind: DraftKind
  /** Decimal string, e.g. "350.00". */
  amount: string
  categoryId?: string
  merchant?: string
  accountId?: string
  debtId?: string
  /** "today", "yesterday" or an ISO date. */
  date?: string
  note?: string
}

/** One turn of the visible conversation, as the client stores it. */
export type ChatTurn =
  | { role: 'user'; text: string }
  | { role: 'assistant'; text: string; draft?: Draft; toolUseId?: string; aside?: string }
  | { role: 'tool_result'; toolUseId: string; result: string }

/** A bounded snapshot of the finances — never raw transaction history (§21). */
export interface FinanceContext {
  name: string
  today: string
  personality: 'gentle' | 'balanced' | 'savage'
  payday: { date: string; inDays: number }
  safeToSpend: string
  dailyAllowance: string
  cash: string
  savings: string
  totalDebt: string
  discretionaryRemaining: string
  envelopes: { id: string; name: string; planned: string; spent: string; essential: boolean }[]
  upcomingBills: { name: string; amount: string; dueIn: number }[]
  debts: { id: string; name: string; balance: string; minPayment: string; monthlyRate: number }[]
  accounts: { id: string; name: string }[]
  categories: { id: string; name: string }[]
}

export interface ChatRequest {
  turns: ChatTurn[]
  context: FinanceContext
}

export type ChatEvent =
  | { type: 'text'; text: string }
  | { type: 'draft'; draft: Draft; toolUseId: string }
  | { type: 'error'; message: string }
  | { type: 'done' }

export interface ChatStatus {
  /** True when the server has credentials and will call Claude for real. */
  live: boolean
  model: string
}
