import { describe, expect, it } from 'vitest'
import type { AppData, Debt } from '../types'
import { peso, sum } from './money'
import { toISO } from './dates'
import {
  availableCash,
  cycleProgress,
  dailyAllowance,
  debtFreeDate,
  discretionaryRemaining,
  healthScore,
  monthlyDebtLoad,
  nextPaydayFor,
  overdueBills,
  planAllocation,
  safeToSpend,
  savingsBalance,
  simulatePayoff,
  simulateStrategy,
  totalDebt,
  upcoming,
  worstVariances,
} from './finance'

const TODAY = new Date('2026-07-15T00:00:00')
const on = (offsetDays: number) => {
  const d = new Date(TODAY)
  d.setDate(d.getDate() + offsetDays)
  return toISO(d)
}

/**
 * A deliberately small ledger with one of everything, so each assertion below
 * points at a single number rather than at an emergent total.
 */
function ledger(overrides: Partial<AppData> = {}): AppData {
  return {
    profile: {
      name: 'Test',
      salary: peso(25_000),
      payCadence: 'semi-monthly',
      personality: 'balanced',
      reactionsOn: true,
      safeToSpendBuffer: peso(500),
      theme: 'sorbetes',
      matchSystemTheme: false,
      onboarded: true,
    },
    accounts: [
      { id: 'bank', name: 'Bank', type: 'bank', balance: peso(10_000) },
      { id: 'cash', name: 'Cash', type: 'cash', balance: peso(2_000) },
      { id: 'save', name: 'Savings', type: 'savings', balance: peso(30_000) },
    ],
    categories: [
      { id: 'food', name: 'Food', emoji: '🍜', kind: 'expense', essential: true },
      { id: 'fun', name: 'Fun', emoji: '🎬', kind: 'expense' },
    ],
    transactions: [],
    debts: [],
    bills: [],
    plan: {
      id: 'p',
      label: 'test',
      total: peso(25_000),
      startsOn: on(-5),
      endsOn: on(10),
      items: [],
    },
    goals: [],
    monthlyFlow: [],
    billsOnTime: { paidOnTime: 0, due: 0 },
    ...overrides,
  }
}

const card = (over: Partial<Debt> = {}): Debt => ({
  id: 'card',
  name: 'Card',
  kind: 'card',
  balance: peso(18_000),
  originalAmount: peso(20_000),
  monthlyRate: 0.03,
  minPayment: peso(900),
  ...over,
})

describe('available cash', () => {
  it('counts cash, bank and e-wallets', () => {
    expect(availableCash(ledger())).toBe(peso(12_000))
  })

  it('leaves savings out — that is the point of savings', () => {
    expect(savingsBalance(ledger())).toBe(peso(30_000))
    // The ₱30,000 in savings is visible, and deliberately not spendable.
    expect(availableCash(ledger())).toBe(peso(12_000))
  })

  it('excludes credit accounts, which are debt wearing an account costume', () => {
    const data = ledger({
      accounts: [
        { id: 'bank', name: 'Bank', type: 'bank', balance: peso(10_000) },
        { id: 'visa', name: 'Visa', type: 'credit', balance: peso(-5_000), linkedDebtId: 'card' },
      ],
    })
    expect(availableCash(data)).toBe(peso(10_000))
  })
})

describe('safe to spend', () => {
  it('is cash minus the bills before payday, the debt minimums, and your cushion', () => {
    const data = ledger({
      bills: [
        {
          id: 'rent',
          name: 'Rent',
          amountDue: peso(8_000),
          amountPaid: 0,
          dueOn: on(3),
          status: 'open',
        },
      ],
    })
    // 12,000 − 8,000 − 500 = 3,500
    expect(safeToSpend(data, TODAY).amount).toBe(peso(3_500))
  })

  it('ignores bills that fall after payday — that is next cycle’s problem', () => {
    const data = ledger({
      bills: [
        {
          id: 'later',
          name: 'Later',
          amountDue: peso(8_000),
          amountPaid: 0,
          dueOn: on(40),
          status: 'open',
        },
      ],
    })
    expect(safeToSpend(data, TODAY).amount).toBe(peso(11_500))
  })

  it('counts only what is still owed on a part-paid bill', () => {
    const data = ledger({
      bills: [
        {
          id: 'rent',
          name: 'Rent',
          amountDue: peso(8_000),
          amountPaid: peso(3_000),
          dueOn: on(3),
          status: 'partial',
        },
      ],
    })
    expect(safeToSpend(data, TODAY).amount).toBe(peso(6_500))
  })

  it('never shows a negative number — it reports a shortfall instead', () => {
    const data = ledger({
      bills: [
        {
          id: 'huge',
          name: 'Huge',
          amountDue: peso(50_000),
          amountPaid: 0,
          dueOn: on(2),
          status: 'open',
        },
      ],
    })
    const result = safeToSpend(data, TODAY)
    expect(result.amount).toBe(0)
    expect(result.shortfall).toBe(peso(38_500))
  })

  it('shows its work: the breakdown adds up to the answer', () => {
    const data = ledger({
      bills: [
        { id: 'a', name: 'A', amountDue: peso(2_000), amountPaid: 0, dueOn: on(2), status: 'open' },
      ],
      debts: [card({ dueDay: new Date(on(4)).getDate() })],
      plan: {
        ...ledger().plan,
        items: [
          { id: 'food', name: 'Food', emoji: '🍜', planned: peso(3_000), spent: peso(1_000), essential: true, categoryId: 'food' },
        ],
      },
    })
    const { amount, breakdown } = safeToSpend(data, TODAY)
    expect(sum(breakdown.map((b) => b.amount))).toBe(amount)
  })

  it('does not subtract a debt minimum twice when a bill already covers it', () => {
    const debt = card({ dueDay: new Date(on(3)).getDate() })
    const data = ledger({
      debts: [debt],
      bills: [
        {
          id: 'cardbill',
          name: 'Card',
          amountDue: peso(900),
          amountPaid: 0,
          dueOn: on(3),
          status: 'open',
          debtId: 'card',
        },
      ],
    })
    // 12,000 − 900 (the bill) − 500 = 10,600. Not 9,700.
    expect(safeToSpend(data, TODAY).amount).toBe(peso(10_600))
  })
})

describe('daily allowance', () => {
  it('divides what is safe by the days left', () => {
    const data = ledger()
    const { perDay, days, payday } = dailyAllowance(data, TODAY)
    expect(days).toBeGreaterThan(0)
    expect(perDay).toBe(Math.round(safeToSpend(data, TODAY, payday).amount / days))
  })

  it('never divides by zero, even standing on payday', () => {
    const data = ledger()
    for (const day of ['2026-07-15', '2026-07-31', '2026-12-31']) {
      const { days, perDay } = dailyAllowance(data, new Date(`${day}T00:00:00`))
      expect(days).toBeGreaterThanOrEqual(1)
      expect(Number.isFinite(perDay)).toBe(true)
    }
  })

  it('is monthly-cadence aware', () => {
    const monthly = ledger()
    monthly.profile.payCadence = 'monthly'
    // Standing on 31 July, the next monthly payday is 31 August: 31 days, not 1.
    const { days } = dailyAllowance(monthly, new Date('2026-07-31T00:00:00'))
    expect(days).toBe(31)
  })
})

describe('upcoming obligations', () => {
  const data = ledger({
    bills: [
      { id: 'a', name: 'A', amountDue: peso(1_000), amountPaid: 0, dueOn: on(-2), status: 'open' },
      { id: 'b', name: 'B', amountDue: peso(2_000), amountPaid: 0, dueOn: on(3), status: 'open' },
      { id: 'c', name: 'C', amountDue: peso(4_000), amountPaid: 0, dueOn: on(20), status: 'open' },
      { id: 'd', name: 'D', amountDue: peso(9_000), amountPaid: peso(9_000), dueOn: on(1), status: 'paid' },
    ],
  })

  it('counts only what is open inside the window', () => {
    const week = upcoming(data, 7, TODAY)
    expect(week.count).toBe(2)
    expect(week.total).toBe(peso(3_000))
  })

  it('includes overdue bills — they have not stopped being due', () => {
    expect(overdueBills(data, TODAY).map((b) => b.id)).toEqual(['a'])
  })

  it('a paid bill is gone from both', () => {
    expect(upcoming(data, 30, TODAY).bills.some((b) => b.id === 'd')).toBe(false)
    expect(overdueBills(data, TODAY).some((b) => b.id === 'd')).toBe(false)
  })
})

describe('the plan', () => {
  const withItems = (items: AppData['plan']['items']) =>
    ledger({ plan: { ...ledger().plan, items } })

  it('reports what is left to assign', () => {
    const data = withItems([
      { id: 'a', name: 'A', emoji: '🏠', planned: peso(10_000), spent: 0 },
    ])
    const { allocated, unallocated, status } = planAllocation(data.plan)
    expect(allocated).toBe(peso(10_000))
    expect(unallocated).toBe(peso(15_000))
    expect(status).toBe('under')
  })

  it('knows when you have gone over', () => {
    const data = withItems([
      { id: 'a', name: 'A', emoji: '🏠', planned: peso(30_000), spent: 0 },
    ])
    expect(planAllocation(data.plan).status).toBe('over')
    expect(planAllocation(data.plan).unallocated).toBe(peso(-5_000))
  })

  it('calls an exact plan exact', () => {
    const data = withItems([
      { id: 'a', name: 'A', emoji: '🏠', planned: peso(25_000), spent: 0 },
    ])
    expect(planAllocation(data.plan).status).toBe('exact')
  })

  it('ranks the worst overspend first, and ignores what is under', () => {
    const data = withItems([
      { id: 'food', name: 'Food', emoji: '🍜', planned: peso(6_000), spent: peso(7_500) },
      { id: 'fun', name: 'Fun', emoji: '🎬', planned: peso(2_000), spent: peso(2_300) },
      { id: 'ok', name: 'Ok', emoji: '✅', planned: peso(1_000), spent: peso(200) },
    ])
    const worst = worstVariances(data.plan, 2)
    expect(worst.map((v) => v.item.id)).toEqual(['food', 'fun'])
    expect(worst[0].variance).toBe(peso(1_500))
  })

  it('counts only unspent discretionary money as still available', () => {
    const data = withItems([
      { id: 'fun', name: 'Fun', emoji: '🎬', planned: peso(2_000), spent: peso(500) },
      { id: 'rent', name: 'Rent', emoji: '🏠', planned: peso(8_000), spent: 0, locked: true },
      { id: 'food', name: 'Food', emoji: '🍜', planned: peso(6_000), spent: 0, essential: true },
    ])
    expect(discretionaryRemaining(data)).toBe(peso(1_500))
  })

  it('keeps cycle progress inside 0–1 however far the date drifts', () => {
    const plan = ledger().plan
    for (const offset of [-100, -5, 0, 5, 100]) {
      const at = new Date(TODAY)
      at.setDate(at.getDate() + offset)
      const p = cycleProgress(plan, at)
      expect(p).toBeGreaterThanOrEqual(0)
      expect(p).toBeLessThanOrEqual(1)
    }
  })
})

describe('debts', () => {
  it('totals only what is still owed', () => {
    const data = ledger({
      debts: [card(), card({ id: 'done', balance: 0, clearedOn: on(-30) })],
    })
    expect(totalDebt(data)).toBe(peso(18_000))
  })

  it('doubles a semi-monthly minimum to get the monthly load', () => {
    const data = ledger({
      debts: [card({ minPayment: peso(500), cadence: 'semi-monthly' })],
    })
    expect(monthlyDebtLoad(data)).toBe(peso(1_000))
  })

  it('says "never" when the payment does not cover the interest', () => {
    // ₱18,000 at 3%/mo accrues ₱540. Paying ₱500 loses ground every month.
    const result = simulatePayoff(card(), peso(500))
    expect(result.never).toBe(true)
    expect(result.debtFreeDate).toBeNull()
  })

  it('pays off and charges interest when the payment clears the interest', () => {
    const result = simulatePayoff(card(), peso(2_000))
    expect(result.never).toBe(false)
    expect(result.months).toBeGreaterThan(9)
    expect(result.totalInterest).toBeGreaterThan(0)
  })

  it('paying more is never slower', () => {
    const slow = simulatePayoff(card(), peso(1_000))
    const fast = simulatePayoff(card(), peso(3_000))
    expect(fast.months).toBeLessThanOrEqual(slow.months)
    expect(fast.totalInterest).toBeLessThanOrEqual(slow.totalInterest)
  })

  it('avalanche never costs more interest than snowball', () => {
    const debts = [
      card({ id: 'small', balance: peso(3_000), monthlyRate: 0.005, minPayment: peso(300) }),
      card({ id: 'big', balance: peso(40_000), monthlyRate: 0.035, minPayment: peso(2_000) }),
    ]
    const snowball = simulateStrategy(debts, peso(3_000), 'snowball')
    const avalanche = simulateStrategy(debts, peso(3_000), 'avalanche')
    expect(avalanche.totalInterest).toBeLessThanOrEqual(snowball.totalInterest)
  })

  it('with no debts, there is nothing to project', () => {
    const data = ledger()
    expect(totalDebt(data)).toBe(0)
    expect(monthlyDebtLoad(data)).toBe(0)
    expect(() => debtFreeDate(data, peso(4_500), TODAY)).not.toThrow()
  })
})

describe('health score', () => {
  it('stays inside 0–100 whatever it is handed', () => {
    const cases: AppData[] = [
      ledger(),
      ledger({ billsOnTime: { paidOnTime: 0, due: 10 } }),
      ledger({ billsOnTime: { paidOnTime: 10, due: 10 } }),
      ledger({ debts: [card({ minPayment: peso(999_999) })] }),
    ]
    for (const data of cases) {
      const { score } = healthScore(data)
      expect(score).toBeGreaterThanOrEqual(0)
      expect(score).toBeLessThanOrEqual(100)
    }
  })

  it('never lets a crushing debt load push the debt factor below zero', () => {
    const data = ledger({ debts: [card({ minPayment: peso(999_999) })] })
    expect(healthScore(data).debtPressure.points).toBe(0)
  })

  it('rewards paying bills on time', () => {
    const bad = healthScore(ledger({ billsOnTime: { paidOnTime: 2, due: 10 } })).billsOnTime.points
    const good = healthScore(ledger({ billsOnTime: { paidOnTime: 10, due: 10 } })).billsOnTime.points
    expect(good).toBeGreaterThan(bad)
  })
})

describe('nextPaydayFor', () => {
  it('reads the cadence off the profile', () => {
    const semi = ledger()
    const monthly = ledger()
    monthly.profile.payCadence = 'monthly'
    const at = new Date('2026-07-20T00:00:00')
    expect(toISO(nextPaydayFor(semi, at))).toBe('2026-07-31')
    expect(toISO(nextPaydayFor(monthly, at))).toBe('2026-07-31')
    const mid = new Date('2026-07-10T00:00:00')
    expect(toISO(nextPaydayFor(semi, mid))).toBe('2026-07-15')
    expect(toISO(nextPaydayFor(monthly, mid))).toBe('2026-07-31')
  })
})
