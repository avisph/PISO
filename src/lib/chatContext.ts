import type { AppData } from '../types'
import type { FinanceContext } from '../../shared/chat'
import { formatMoney, toPesos } from './money'
import {
  availableCash,
  billOutstanding,
  dailyAllowance,
  discretionaryRemaining,
  activeDebts,
  safeToSpend,
  savingsBalance,
  totalDebt,
  upcoming,
} from './finance'
import { daysBetween, formatShort, parseISO, today } from './dates'

const money = (centavos: number) => toPesos(centavos).toFixed(2)

/**
 * The bounded snapshot Bes is briefed with (blueprint §21). Derived numbers
 * only — no transaction history, no account numbers, no PII beyond the first
 * name the user typed themselves.
 */
export function buildContext(data: AppData): FinanceContext {
  const now = today()
  const allowance = dailyAllowance(data, now)

  return {
    name: data.profile.name,
    today: formatShort(now),
    personality: data.profile.personality,
    payday: {
      date: formatShort(allowance.payday),
      inDays: allowance.days,
    },
    safeToSpend: money(safeToSpend(data, now).amount),
    dailyAllowance: money(allowance.perDay),
    cash: money(availableCash(data)),
    savings: money(savingsBalance(data)),
    totalDebt: money(totalDebt(data)),
    discretionaryRemaining: money(discretionaryRemaining(data)),
    envelopes: data.plan.items.map((item) => ({
      id: item.categoryId ?? item.id,
      name: item.name,
      planned: money(item.planned),
      spent: money(item.spent),
      essential: Boolean(item.essential),
    })),
    upcomingBills: upcoming(data, 30, now).bills.map((bill) => ({
      name: bill.name,
      amount: money(billOutstanding(bill)),
      dueIn: daysBetween(now, parseISO(bill.dueOn)),
    })),
    debts: activeDebts(data).map((debt) => ({
      id: debt.id,
      name: debt.name,
      balance: money(debt.balance),
      minPayment: money(debt.minPayment),
      monthlyRate: debt.monthlyRate,
    })),
    accounts: data.accounts
      .filter((a) => a.type !== 'credit')
      .map((a) => ({ id: a.id, name: a.name })),
    categories: data.categories.map((c) => ({ id: c.id, name: c.name })),
  }
}

/** Human-readable summary of a draft, for the tool_result we send back. */
export function describeDraft(
  data: AppData,
  draft: { kind: string; amount: string; categoryId?: string; accountId?: string },
  outcome: 'confirmed' | 'discarded',
): string {
  const category = data.categories.find((c) => c.id === draft.categoryId)?.name
  const account = data.accounts.find((a) => a.id === draft.accountId)?.name
  const amount = formatMoney(Math.round(Number(draft.amount) * 100))
  return outcome === 'confirmed'
    ? `The user confirmed the draft: ${draft.kind} ${amount}${category ? ` · ${category}` : ''}${
        account ? ` · ${account}` : ''
      }. It is saved now.`
    : 'The user discarded the draft. Nothing was saved.'
}
