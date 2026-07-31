import { describe, expect, it } from 'vitest'
import {
  COMMON_BILLS,
  DEFAULT_ACCOUNTS,
  createStarterData,
  nextDueDate,
  type SetupAnswers,
} from './starter'
import { peso } from '../lib/money'
import { addDays, currentPaydayOn, nextPaydayOn, toISO, today } from '../lib/dates'
import { availableCash, planAllocation, safeToSpend } from '../lib/finance'

const now = today()

const answers = (over: Partial<SetupAnswers> = {}): SetupAnswers => ({
  name: 'Dafdays',
  payCadence: 'semi-monthly',
  salary: peso(25_000),
  accounts: [
    { name: 'Wallet cash', type: 'cash', balance: peso(500) },
    { name: 'Bank', type: 'bank', balance: peso(9_000) },
    { name: 'GCash', type: 'ewallet', balance: peso(2_000) },
  ],
  bills: [
    { name: 'Rent', emoji: '🏠', amountDue: peso(8_000), dueDay: 5 },
    { name: 'Electricity', emoji: '💡', amountDue: 0, dueDay: 12 },
  ],
  ...over,
})

describe('what onboarding builds', () => {
  it('keeps what you entered and nothing else', () => {
    const data = createStarterData(answers())
    expect(data.profile.name).toBe('Dafdays')
    expect(data.profile.salary).toBe(peso(25_000))
    expect(data.accounts).toHaveLength(3)
    expect(availableCash(data)).toBe(peso(11_500))
  })

  it('invents nothing — no transactions, no debts, no history', () => {
    const data = createStarterData(answers())
    expect(data.transactions).toEqual([])
    expect(data.debts).toEqual([])
    expect(data.goals).toEqual([])
    expect(data.monthlyFlow).toEqual([])
    expect(data.billsOnTime).toEqual({ paidOnTime: 0, due: 0 })
  })

  it('drops a bill left at ₱0 rather than tracking an empty one', () => {
    const data = createStarterData(answers())
    expect(data.bills.map((b) => b.name)).toEqual(['Rent'])
  })

  it('drops an account with no name', () => {
    const data = createStarterData(
      answers({
        accounts: [
          { name: 'Bank', type: 'bank', balance: peso(1_000) },
          { name: '   ', type: 'cash', balance: peso(500) },
        ],
      }),
    )
    expect(data.accounts).toHaveLength(1)
  })

  it('gives every account a distinct id, even with repeated names', () => {
    const data = createStarterData(
      answers({
        accounts: [
          { name: 'Bank', type: 'bank', balance: peso(1) },
          { name: 'Bank', type: 'bank', balance: peso(2) },
          { name: '💳💳💳', type: 'bank', balance: peso(3) },
        ],
      }),
    )
    expect(new Set(data.accounts.map((a) => a.id)).size).toBe(3)
    expect(data.accounts.every((a) => a.id.length > 0)).toBe(true)
  })

  it('funds each bill as a locked plan row', () => {
    const data = createStarterData(answers())
    const locked = data.plan.items.filter((i) => i.locked)
    expect(locked).toHaveLength(1)
    expect(locked[0].planned).toBe(peso(8_000))
    expect(locked[0].billId).toBe(data.bills[0].id)
  })

  it('opens the starter envelopes at ₱0, and steppable', () => {
    const data = createStarterData(answers())
    const open = data.plan.items.filter((i) => !i.locked)
    expect(open.length).toBeGreaterThan(0)
    expect(open.every((i) => i.planned === 0)).toBe(true)
    // `suggested` hides the stepper in the planner — these must not carry it,
    // or you cannot fund your own food budget.
    expect(open.every((i) => !i.suggested)).toBe(true)
  })

  it('leaves the rest of the salary to assign', () => {
    const data = createStarterData(answers())
    const { unallocated, status } = planAllocation(data.plan)
    expect(status).toBe('under')
    expect(unallocated).toBe(peso(17_000))
  })

  it('dates the cycle from the cadence you chose', () => {
    for (const cadence of ['semi-monthly', 'monthly'] as const) {
      const data = createStarterData(answers({ payCadence: cadence }))
      expect(data.plan.startsOn).toBe(toISO(currentPaydayOn(cadence, now)))
      expect(data.plan.endsOn).toBe(toISO(addDays(nextPaydayOn(cadence, now), -1)))
    }
  })

  it('produces a ledger the engine can read without throwing', () => {
    const data = createStarterData(answers())
    expect(() => safeToSpend(data, now)).not.toThrow()
    expect(safeToSpend(data, now).amount).toBeGreaterThanOrEqual(0)
  })

  it('survives someone deleting every bill and every extra account', () => {
    const data = createStarterData(
      answers({ bills: [], accounts: [{ name: 'Cash', type: 'cash', balance: 0 }] }),
    )
    expect(data.bills).toEqual([])
    expect(availableCash(data)).toBe(0)
    expect(safeToSpend(data, now).amount).toBe(0)
  })
})

describe('when a bill next falls due', () => {
  it('is this month if the day has not passed', () => {
    const from = new Date('2026-07-10T00:00:00')
    expect(toISO(nextDueDate(20, from))).toBe('2026-07-20')
  })

  it('rolls to next month once the day has gone', () => {
    const from = new Date('2026-07-25T00:00:00')
    expect(toISO(nextDueDate(20, from))).toBe('2026-08-20')
  })

  it('counts today as still due today', () => {
    const from = new Date('2026-07-20T00:00:00')
    expect(toISO(nextDueDate(20, from))).toBe('2026-07-20')
  })

  it('clamps "the 31st" to the end of a short month instead of spilling over', () => {
    expect(toISO(nextDueDate(31, new Date('2026-06-01T00:00:00')))).toBe('2026-06-30')
    expect(toISO(nextDueDate(31, new Date('2026-02-01T00:00:00')))).toBe('2026-02-28')
    expect(toISO(nextDueDate(30, new Date('2026-02-01T00:00:00')))).toBe('2026-02-28')
  })

  it('handles the leap day', () => {
    expect(toISO(nextDueDate(29, new Date('2028-02-01T00:00:00')))).toBe('2028-02-29')
    expect(toISO(nextDueDate(29, new Date('2026-02-01T00:00:00')))).toBe('2026-02-28')
  })

  it('crosses the year end', () => {
    expect(toISO(nextDueDate(5, new Date('2026-12-20T00:00:00')))).toBe('2027-01-05')
  })
})

describe('the defaults the form starts with', () => {
  it('offers accounts and bills at ₱0, so nothing is assumed about you', () => {
    expect(DEFAULT_ACCOUNTS.every((a) => a.balance === 0)).toBe(true)
    expect(COMMON_BILLS.every((b) => b.amountDue === 0)).toBe(true)
  })

  it('keeps every default due day inside a month', () => {
    expect(COMMON_BILLS.every((b) => b.dueDay >= 1 && b.dueDay <= 31)).toBe(true)
  })
})
