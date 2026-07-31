import type { Centavos } from './lib/money'
import type { ISODate } from './lib/dates'

export type AccountType = 'cash' | 'bank' | 'ewallet' | 'savings' | 'credit'

export interface Account {
  id: string
  name: string
  type: AccountType
  balance: Centavos
  /** Credit cards carry the linked debt so the pair is only counted once. */
  linkedDebtId?: string
}

export interface Category {
  id: string
  name: string
  emoji: string
  kind: 'expense' | 'income'
  /** Essentials are subtracted from safe-to-spend (§13.2). */
  essential?: boolean
}

export type TransactionKind = 'expense' | 'income' | 'transfer' | 'debt_payment'

export interface Transaction {
  id: string
  kind: TransactionKind
  amount: Centavos
  categoryId?: string
  accountId: string
  toAccountId?: string
  debtId?: string
  merchant?: string
  note?: string
  date: ISODate
  createdAt: number
  /** Set when Bes parsed it from chat rather than the keypad. */
  source?: 'keypad' | 'chat'
}

export type DebtKind = 'card' | 'loan' | 'installment' | 'informal'

export interface Debt {
  id: string
  name: string
  kind: DebtKind
  balance: Centavos
  originalAmount: Centavos
  /** Monthly interest as a fraction — 0.03 is 3%/mo. Informal debts are 0. */
  monthlyRate: number
  minPayment: Centavos
  /** Day of month the payment is due; installments use the same field. */
  dueDay?: number
  creditLimit?: Centavos
  /** Installments: how many of how many. */
  termsPaid?: number
  termsTotal?: number
  /** Semi-monthly deductions (SSS) rather than a monthly minimum. */
  cadence?: 'monthly' | 'semi-monthly'
  note?: string
  clearedOn?: ISODate
  history?: DebtEvent[]
}

export interface DebtEvent {
  id: string
  date: ISODate
  label: string
  amount: Centavos
  /** payment reduces, charge increases, adjustment is a statement sync. */
  kind: 'payment' | 'charge' | 'adjustment'
}

export type BillStatus = 'open' | 'partial' | 'paid'

export interface Bill {
  id: string
  name: string
  amountDue: Centavos
  amountPaid: Centavos
  dueOn: ISODate
  status: BillStatus
  emoji?: string
  /** Free-text hint the row shows under the name ("usually ~₱2,300"). */
  hint?: string
  /** Paying this bill also pays down a debt. */
  debtId?: string
  recurring?: boolean
}

export interface PlanItem {
  id: string
  name: string
  emoji: string
  planned: Centavos
  spent: Centavos
  essential?: boolean
  /** Locked items are funded obligations — rent, a card minimum. */
  locked?: boolean
  /** Copy shown on the right of the planner row. */
  note?: string
  /** Marked as the assistant's suggestion in the planner. */
  suggested?: boolean
  billId?: string
  debtId?: string
  categoryId?: string
}

export interface Plan {
  id: string
  label: string
  total: Centavos
  startsOn: ISODate
  endsOn: ISODate
  items: PlanItem[]
}

export interface Goal {
  id: string
  name: string
  saved: Centavos
  target: Centavos
  targetDate?: ISODate
}

export type Personality = 'gentle' | 'balanced' | 'savage'

export type ThemeId = 'sorbetes' | 'ube' | 'mint' | 'acid'

export interface Profile {
  name: string
  /** Take-home per payout; the persona is semi-monthly ₱25,000. */
  salary: Centavos
  payCadence: 'semi-monthly' | 'monthly'
  personality: Personality
  reactionsOn: boolean
  /** The cushion held back from safe-to-spend (§13.2). */
  safeToSpendBuffer: Centavos
  theme: ThemeId
  matchSystemTheme: boolean
  onboarded: boolean
}

export interface AppData {
  profile: Profile
  accounts: Account[]
  categories: Category[]
  transactions: Transaction[]
  debts: Debt[]
  bills: Bill[]
  plan: Plan
  goals: Goal[]
  /** Rolling monthly totals for the Reports bars. */
  monthlyFlow: { label: string; moneyIn: Centavos; moneyOut: Centavos }[]
  billsOnTime: { paidOnTime: number; due: number }
}
