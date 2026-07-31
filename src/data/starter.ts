/**
 * Turns the onboarding answers into a real ledger.
 *
 * The seed in `seed.ts` is Dafhnee — an invented persona the mockups were drawn
 * around, useful for a demo and useless for your own money. This builds the
 * same shape from what you actually told us, and invents nothing: no starter
 * transactions, no debts you did not enter, and no envelope amounts we guessed
 * on your behalf. What you did not say stays empty until you say it.
 */

import type {
  Account,
  AccountType,
  AppData,
  Bill,
  PlanItem,
  Profile,
} from '../types'
import { peso, type Centavos } from '../lib/money'
import { addDays, currentPaydayOn, nextPaydayOn, toISO, today } from '../lib/dates'
import { createSeedData } from './seed'

export interface AccountAnswer {
  name: string
  type: AccountType
  balance: Centavos
}

export interface BillAnswer {
  name: string
  emoji: string
  amountDue: Centavos
  /** Day of the month it lands. 31 means "end of month" on short months. */
  dueDay: number
}

export interface SetupAnswers {
  name: string
  payCadence: Profile['payCadence']
  /** Take-home per payout, not per month. */
  salary: Centavos
  accounts: AccountAnswer[]
  bills: BillAnswer[]
}

/**
 * The envelopes we open for you — all at ₱0 until you plan them. They are
 * ordinary spendable envelopes, deliberately not `suggested`: in the planner
 * that flag means "the assistant picked this amount" and hides the stepper,
 * which would leave you unable to fund your own food budget.
 */
const STARTER_ENVELOPES: { id: string; name: string; emoji: string; essential?: boolean }[] = [
  { id: 'food', name: 'Food', emoji: '🍜', essential: true },
  { id: 'transpo', name: 'Transpo', emoji: '🚌', essential: true },
  { id: 'grocery', name: 'Grocery', emoji: '🛒', essential: true },
  { id: 'load', name: 'Load & data', emoji: '📶' },
  { id: 'fun', name: 'Fun', emoji: '🎬' },
  // healthScore() looks for this id when scoring the saving habit.
  { id: 'emergency', name: 'Emergency fund', emoji: '🏦' },
]

/**
 * The next date this bill falls due. A `dueDay` past the end of a short month
 * lands on that month's last day rather than spilling into the next one —
 * "the 31st" on a 30-day month means the 30th, not the 1st.
 */
export function nextDueDate(dueDay: number, from: Date = today()): Date {
  const clampToMonth = (year: number, month: number) => {
    const last = new Date(year, month + 1, 0).getDate()
    return new Date(year, month, Math.min(dueDay, last))
  }
  const thisMonth = clampToMonth(from.getFullYear(), from.getMonth())
  return thisMonth >= from ? thisMonth : clampToMonth(from.getFullYear(), from.getMonth() + 1)
}

const slug = (name: string, index: number) =>
  `${name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'item'}-${index}`

export function createStarterData(answers: SetupAnswers): AppData {
  const now = today()
  // The cycle runs payday-to-payday, and which days those are depends on the
  // cadence they just told us — not on the persona's semi-monthly payroll.
  const cycleStart = currentPaydayOn(answers.payCadence, now)
  const cycleEnd = addDays(nextPaydayOn(answers.payCadence, now), -1)

  const accounts: Account[] = answers.accounts
    .filter((a) => a.name.trim())
    .map((a, i) => ({
      id: slug(a.name, i),
      name: a.name.trim(),
      type: a.type,
      balance: a.balance,
    }))

  const bills: Bill[] = answers.bills
    .filter((b) => b.name.trim() && b.amountDue > 0)
    .map((b, i) => ({
      id: slug(b.name, i),
      name: b.name.trim(),
      emoji: b.emoji,
      amountDue: b.amountDue,
      amountPaid: 0,
      dueOn: toISO(nextDueDate(b.dueDay, now)),
      status: 'open' as const,
      recurring: true,
    }))

  // Bills are already spoken for, so they enter the plan funded and locked.
  // Everything else starts at ₱0 — the planner's job is to assign the rest,
  // and a number we invented would only look like one you chose.
  const items: PlanItem[] = [
    ...bills.map<PlanItem>((b) => ({
      id: `b:${b.id}`,
      name: b.name,
      emoji: b.emoji ?? '🧾',
      planned: b.amountDue,
      spent: 0,
      essential: true,
      locked: true,
      note: 'bill',
      billId: b.id,
    })),
    ...STARTER_ENVELOPES.map<PlanItem>((s) => ({
      id: s.id,
      name: s.name,
      emoji: s.emoji,
      planned: 0,
      spent: 0,
      essential: s.essential,
      categoryId: s.id === 'emergency' || s.id === 'load' ? undefined : s.id,
    })),
  ]

  const profile: Profile = {
    name: answers.name.trim() || 'you',
    salary: answers.salary,
    payCadence: answers.payCadence,
    personality: 'balanced',
    reactionsOn: true,
    // The blueprint's default cushion. Change it in Settings.
    safeToSpendBuffer: peso(500),
    theme: 'sorbetes',
    matchSystemTheme: false,
    onboarded: false,
  }

  return {
    profile,
    accounts,
    // The category list is generic, not Dafhnee's — worth keeping.
    categories: createSeedData().categories,
    transactions: [],
    debts: [],
    bills,
    plan: {
      id: 'plan-current',
      label: `${cycleStart.toLocaleDateString('en-PH', { month: 'long', day: 'numeric' })} salary`,
      total: answers.salary,
      startsOn: toISO(cycleStart),
      endsOn: toISO(cycleEnd),
      items,
    },
    goals: [],
    monthlyFlow: [],
    billsOnTime: { paidOnTime: 0, due: 0 },
  }
}

/** What step 2 starts with — the three places most people actually keep money. */
export const DEFAULT_ACCOUNTS: AccountAnswer[] = [
  { name: 'Wallet cash', type: 'cash', balance: 0 },
  { name: 'Bank', type: 'bank', balance: 0 },
  { name: 'GCash', type: 'ewallet', balance: 0 },
]

/** What step 3 offers. Amounts stay ₱0 until you fill them in. */
export const COMMON_BILLS: BillAnswer[] = [
  { name: 'Rent', emoji: '🏠', amountDue: 0, dueDay: 5 },
  { name: 'Electricity', emoji: '💡', amountDue: 0, dueDay: 12 },
  { name: 'Water', emoji: '🚿', amountDue: 0, dueDay: 15 },
  { name: 'Internet', emoji: '📶', amountDue: 0, dueDay: 20 },
]
