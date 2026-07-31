/**
 * The pure finance core (blueprint §13). No I/O, no React, no dates beyond the
 * ones passed in — everything here is (data in) → (numbers out) so the same
 * functions can render the dashboard and brief the assistant.
 */

import type { AppData, Bill, Debt, Plan, PlanItem } from '../types'
import { clampZero, sum, type Centavos } from './money'
import {
  addMonths,
  daysBetween,
  formatMonthYear,
  nextPaydayOn,
  parseISO,
  today as todayFn,
} from './dates'

/* ── 13.1 Available cash ──────────────────────────────────────────────────── */

export const availableCash = (data: AppData): Centavos =>
  sum(
    data.accounts
      .filter((a) => a.type === 'cash' || a.type === 'bank' || a.type === 'ewallet')
      .map((a) => a.balance),
  )

export const savingsBalance = (data: AppData): Centavos =>
  sum(data.accounts.filter((a) => a.type === 'savings').map((a) => a.balance))

/* ── 13.11 Upcoming obligations ───────────────────────────────────────────── */

export const billOutstanding = (bill: Bill): Centavos =>
  clampZero(bill.amountDue - bill.amountPaid)

export const openBills = (data: AppData): Bill[] =>
  data.bills.filter((b) => b.status !== 'paid')

export function billsDueBy(data: AppData, cutoff: Date): Bill[] {
  return openBills(data)
    .filter((b) => parseISO(b.dueOn) <= cutoff)
    .sort((a, b) => a.dueOn.localeCompare(b.dueOn))
}

export function upcoming(data: AppData, days: number, from: Date = todayFn()) {
  const cutoff = new Date(from)
  cutoff.setDate(cutoff.getDate() + days)
  const bills = billsDueBy(data, cutoff)
  return { bills, total: sum(bills.map(billOutstanding)), count: bills.length }
}

export const overdueBills = (data: AppData, from: Date = todayFn()): Bill[] =>
  openBills(data)
    .filter((b) => parseISO(b.dueOn) < from)
    .sort((a, b) => a.dueOn.localeCompare(b.dueOn))

/* ── 13.2 Safe-to-spend ───────────────────────────────────────────────────── */

export interface SafeToSpend {
  amount: Centavos
  /** Every subtraction, so the math stays inspectable ("see the math"). */
  breakdown: { label: string; amount: Centavos }[]
  shortfall: Centavos
}

export function safeToSpend(
  data: AppData,
  from: Date = todayFn(),
  payday: Date = nextPaydayFor(data, from),
): SafeToSpend {
  const cash = availableCash(data)

  const obligations = openBills(data)
    .filter((b) => parseISO(b.dueOn) < payday)
    .map(billOutstanding)
  const obligationsTotal = sum(obligations)

  // Debt minimums due before payday that no bill instance already covers.
  const coveredDebtIds = new Set(
    openBills(data)
      .filter((b) => b.debtId && parseISO(b.dueOn) < payday)
      .map((b) => b.debtId),
  )
  const debtMinimums = sum(
    data.debts
      .filter((d) => !d.clearedOn && !coveredDebtIds.has(d.id) && dueBeforePayday(d, from, payday))
      .map((d) => d.minPayment),
  )

  const essentialRemaining = sum(
    data.plan.items
      .filter((i) => i.essential && !i.billId && !i.debtId)
      .map((i) => clampZero(i.planned - i.spent)),
  )

  const buffer = data.profile.safeToSpendBuffer

  const raw = cash - obligationsTotal - debtMinimums - essentialRemaining - buffer

  return {
    // Never show a negative "safe" number (§13.2).
    amount: clampZero(raw),
    shortfall: raw < 0 ? -raw : 0,
    breakdown: [
      { label: 'Cash & bank', amount: cash },
      { label: 'Bills before payday', amount: -obligationsTotal },
      ...(debtMinimums > 0
        ? [{ label: 'Debt minimums before payday', amount: -debtMinimums }]
        : []),
      { label: 'Essentials still to spend', amount: -essentialRemaining },
      { label: 'Your cushion', amount: -buffer },
    ],
  }
}

function dueBeforePayday(debt: Debt, from: Date, payday: Date): boolean {
  if (!debt.dueDay) return debt.cadence === 'semi-monthly'
  const due = new Date(from.getFullYear(), from.getMonth(), debt.dueDay)
  if (due < from) due.setMonth(due.getMonth() + 1)
  return due < payday
}

export const nextPaydayFor = (data: AppData, from: Date = todayFn()): Date =>
  nextPaydayOn(data.profile.payCadence, from)

/* ── 13.12 Daily allowance ────────────────────────────────────────────────── */

export function dailyAllowance(
  data: AppData,
  from: Date = todayFn(),
): { perDay: Centavos; days: number; payday: Date } {
  const payday = nextPaydayFor(data, from)
  const days = Math.max(1, daysBetween(from, payday))
  return { perDay: Math.round(safeToSpend(data, from, payday).amount / days), days, payday }
}

/* ── 13.13 Discretionary remaining ────────────────────────────────────────── */

export const discretionaryRemaining = (data: AppData): Centavos =>
  sum(
    data.plan.items
      .filter((i) => !i.essential && !i.locked)
      .map((i) => clampZero(i.planned - i.spent)),
  )

/* ── 13.3 Plan allocation ─────────────────────────────────────────────────── */

export type PlanStatus = 'under' | 'exact' | 'over'

export function planAllocation(plan: Plan): {
  allocated: Centavos
  unallocated: Centavos
  status: PlanStatus
} {
  const allocated = sum(plan.items.map((i) => i.planned))
  const unallocated = plan.total - allocated
  return {
    allocated,
    unallocated,
    status: unallocated > 0 ? 'under' : unallocated === 0 ? 'exact' : 'over',
  }
}

/** How far through the cycle we are, 0–1 — the "73% through" label. */
export function cycleProgress(plan: Plan, from: Date = todayFn()): number {
  const start = parseISO(plan.startsOn)
  const end = parseISO(plan.endsOn)
  const total = Math.max(1, daysBetween(start, end))
  return Math.min(1, Math.max(0, daysBetween(start, from) / total))
}

/* ── 13.10 Plan variance ──────────────────────────────────────────────────── */

export interface Variance {
  item: PlanItem
  variance: Centavos
  variancePct: number
}

export function planVariance(plan: Plan): Variance[] {
  return plan.items
    .filter((i) => i.planned > 0)
    .map((i) => ({
      item: i,
      variance: i.spent - i.planned,
      variancePct: i.spent / i.planned - 1,
    }))
    .sort((a, b) => b.variance - a.variance)
}

export const worstVariances = (plan: Plan, count = 2): Variance[] =>
  planVariance(plan)
    .filter((v) => v.variance > 0)
    .slice(0, count)

/* ── 13.5 Debt totals ─────────────────────────────────────────────────────── */

export const activeDebts = (data: AppData): Debt[] =>
  data.debts.filter((d) => !d.clearedOn)

export const totalDebt = (data: AppData): Centavos =>
  sum(activeDebts(data).map((d) => d.balance))

export const monthlyDebtLoad = (data: AppData): Centavos =>
  sum(
    activeDebts(data).map((d) =>
      d.cadence === 'semi-monthly' ? d.minPayment * 2 : d.minPayment,
    ),
  )

export const debtProgress = (debt: Debt): number =>
  debt.originalAmount === 0 ? 0 : 1 - debt.balance / debt.originalAmount

export const cardUtilization = (debt: Debt): number | null =>
  debt.creditLimit ? debt.balance / debt.creditLimit : null

/* ── 13.6 Payoff projection ───────────────────────────────────────────────── */

export interface Payoff {
  months: number
  debtFreeDate: Date | null
  totalInterest: Centavos
  never: boolean
}

export function simulatePayoff(
  debt: Debt,
  monthlyPayment: Centavos,
  from: Date = todayFn(),
): Payoff {
  let balance = debt.balance
  let months = 0
  let totalInterest = 0

  if (monthlyPayment <= Math.round(balance * debt.monthlyRate)) {
    return { months: Infinity, debtFreeDate: null, totalInterest: 0, never: true }
  }

  while (balance > 0 && months < 600) {
    const interest = Math.round(balance * debt.monthlyRate)
    totalInterest += interest
    balance = balance + interest - monthlyPayment
    months += 1
  }

  return {
    months,
    debtFreeDate: addMonths(from, months),
    totalInterest,
    never: false,
  }
}

/** Every debt paid at its minimum plus `extra` poured into one target. */
export function simulateStrategy(
  debts: Debt[],
  extra: Centavos,
  strategy: 'snowball' | 'avalanche',
  from: Date = todayFn(),
): { months: number; debtFreeDate: Date | null; totalInterest: Centavos } {
  const order = [...debts]
    .filter((d) => !d.clearedOn && d.balance > 0)
    .sort((a, b) =>
      strategy === 'snowball'
        ? a.balance - b.balance
        : b.monthlyRate - a.monthlyRate || a.balance - b.balance,
    )

  const balances = new Map(order.map((d) => [d.id, d.balance]))
  const minimums = new Map(
    order.map((d) => [d.id, d.cadence === 'semi-monthly' ? d.minPayment * 2 : d.minPayment]),
  )

  let months = 0
  let totalInterest = 0
  let freed = 0

  while ([...balances.values()].some((b) => b > 0) && months < 600) {
    let pot = extra + freed
    for (const debt of order) {
      const balance = balances.get(debt.id) ?? 0
      if (balance <= 0) continue
      const interest = Math.round(balance * debt.monthlyRate)
      totalInterest += interest
      balances.set(debt.id, balance + interest)
    }
    for (const debt of order) {
      const balance = balances.get(debt.id) ?? 0
      if (balance <= 0) continue
      const payment = Math.min(balance, minimums.get(debt.id) ?? 0)
      balances.set(debt.id, balance - payment)
    }
    for (const debt of order) {
      if (pot <= 0) break
      const balance = balances.get(debt.id) ?? 0
      if (balance <= 0) continue
      const payment = Math.min(balance, pot)
      balances.set(debt.id, balance - payment)
      pot -= payment
    }
    freed = sum(
      order
        .filter((d) => (balances.get(d.id) ?? 0) <= 0)
        .map((d) => minimums.get(d.id) ?? 0),
    )
    months += 1
  }

  return {
    months,
    debtFreeDate: months >= 600 ? null : addMonths(from, months),
    totalInterest,
  }
}

/** The headline on the debts screen: "Debt-free: March 2028 at current pace". */
export function debtFreeDate(
  data: AppData,
  monthlyPace: Centavos,
  from: Date = todayFn(),
): { date: Date | null; label: string; pace: Centavos } {
  const load = monthlyDebtLoad(data)
  const pace = Math.max(monthlyPace, load)
  const result = simulateStrategy(activeDebts(data), Math.max(0, pace - load), 'avalanche', from)
  return {
    date: result.debtFreeDate,
    label: result.debtFreeDate ? formatMonthYear(result.debtFreeDate) : 'not at this pace',
    pace,
  }
}

/* ── 13.4 Cash flow ───────────────────────────────────────────────────────── */

export function monthCashFlow(data: AppData, monthOffset = 0, from: Date = todayFn()) {
  const target = new Date(from.getFullYear(), from.getMonth() + monthOffset, 1)
  const inMonth = data.transactions.filter((t) => {
    const d = parseISO(t.date)
    return d.getFullYear() === target.getFullYear() && d.getMonth() === target.getMonth()
  })
  const moneyIn = sum(inMonth.filter((t) => t.kind === 'income').map((t) => t.amount))
  const moneyOut = sum(
    inMonth.filter((t) => t.kind === 'expense' || t.kind === 'debt_payment').map((t) => t.amount),
  )
  return { moneyIn, moneyOut, net: moneyIn - moneyOut }
}

/* ── 13.9 Health score ────────────────────────────────────────────────────── */

export interface HealthScore {
  score: number
  billsOnTime: { points: number; max: 40; paid: number; due: number }
  debtPressure: { points: number; max: 30; ratio: number }
  savingHabit: { points: number; max: 30; rate: number }
}

export function healthScore(data: AppData): HealthScore {
  const clamp = (n: number) => Math.min(1, Math.max(0, n))

  const { paidOnTime, due } = data.billsOnTime
  const billsFraction = due === 0 ? 1 : paidOnTime / due
  const billPoints = 40 * billsFraction

  const monthlyIncome =
    data.profile.payCadence === 'semi-monthly' ? data.profile.salary * 2 : data.profile.salary
  const ratio = monthlyIncome === 0 ? 1 : monthlyDebtLoad(data) / monthlyIncome
  const debtPoints = 30 * clamp(1 - ratio)

  const savingsInflow = sum(
    data.plan.items.filter((i) => i.id === 'emergency' || i.categoryId === 'savings').map((i) => i.planned),
  )
  const rate = monthlyIncome === 0 ? 0 : (savingsInflow * 2) / monthlyIncome
  const savingPoints = 30 * clamp(rate / 0.2)

  return {
    score: Math.round(billPoints + debtPoints + savingPoints),
    billsOnTime: { points: Math.round(billPoints), max: 40, paid: paidOnTime, due },
    debtPressure: { points: Math.round(debtPoints), max: 30, ratio },
    savingHabit: { points: Math.round(savingPoints), max: 30, rate },
  }
}
