import { describe, expect, it } from 'vitest'
import { reducer, rollCycle, whyNotDeleteAccount, whyNotDeleteDebt, type Action } from './store'
import type { AppData } from '../types'
import { peso } from '../lib/money'
import { addDays, currentPaydayOn, nextPaydayOn, toISO, today } from '../lib/dates'
import { availableCash, defaultSpendAccountId, totalDebt } from '../lib/finance'

const now = today()
const on = (offset: number) => toISO(addDays(now, offset))

function ledger(): AppData {
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
      { id: 'gcash', name: 'GCash', type: 'ewallet', balance: peso(3_000) },
      { id: 'save', name: 'Savings', type: 'savings', balance: peso(20_000) },
    ],
    categories: [
      { id: 'food', name: 'Food', emoji: '🍜', kind: 'expense', essential: true },
      { id: 'fun', name: 'Fun', emoji: '🎬', kind: 'expense' },
      { id: 'salary', name: 'Salary', emoji: '💼', kind: 'income' },
    ],
    transactions: [],
    debts: [
      {
        id: 'card',
        name: 'Card',
        kind: 'card',
        balance: peso(18_000),
        originalAmount: peso(20_000),
        monthlyRate: 0.03,
        minPayment: peso(900),
        history: [],
      },
    ],
    bills: [
      {
        id: 'rent',
        name: 'Rent',
        amountDue: peso(8_000),
        amountPaid: 0,
        dueOn: on(3),
        status: 'open',
        recurring: true,
      },
    ],
    plan: {
      id: 'p',
      label: 'test',
      total: peso(25_000),
      startsOn: toISO(currentPaydayOn('semi-monthly', now)),
      endsOn: toISO(addDays(nextPaydayOn('semi-monthly', now), -1)),
      items: [
        { id: 'food', name: 'Food', emoji: '🍜', planned: peso(6_000), spent: 0, categoryId: 'food' },
        { id: 'fun', name: 'Fun', emoji: '🎬', planned: peso(2_000), spent: 0, categoryId: 'fun' },
        { id: 'card', name: 'Card', emoji: '💳', planned: peso(900), spent: 0, debtId: 'card', locked: true },
      ],
    },
    goals: [],
    monthlyFlow: [],
    billsOnTime: { paidOnTime: 0, due: 0 },
  }
}

const run = (state: AppData, ...actions: Action[]) => actions.reduce(reducer, state)

/** Everything derived, in one object, so a round-trip can be compared wholesale. */
const snapshot = (s: AppData) => ({
  cash: availableCash(s),
  debt: totalDebt(s),
  balances: s.accounts.map((a) => `${a.id}:${a.balance}`),
  envelopes: s.plan.items.map((i) => `${i.id}:${i.spent}`),
  history: s.debts.flatMap((d) => (d.history ?? []).map((h) => h.id)),
  bills: s.bills.map((b) => `${b.id}:${b.amountPaid}:${b.status}`),
})

const expense = (over: Partial<Parameters<typeof reducer>[1] & object> = {}) =>
  ({
    type: 'transaction/add',
    transaction: {
      kind: 'expense',
      amount: peso(340),
      categoryId: 'food',
      accountId: 'gcash',
      merchant: 'Jollibee',
      date: on(0),
    },
    ...over,
  }) as Action

describe('adding a transaction', () => {
  it('moves the account and the envelope together', () => {
    const after = run(ledger(), expense())
    expect(after.accounts.find((a) => a.id === 'gcash')!.balance).toBe(peso(2_660))
    expect(after.plan.items.find((i) => i.id === 'food')!.spent).toBe(peso(340))
    expect(after.transactions).toHaveLength(1)
  })

  it('income moves the balance the other way', () => {
    const after = run(ledger(), {
      type: 'transaction/add',
      transaction: {
        kind: 'income',
        amount: peso(25_000),
        categoryId: 'salary',
        accountId: 'bank',
        date: on(0),
      },
    })
    expect(after.accounts.find((a) => a.id === 'bank')!.balance).toBe(peso(35_000))
  })

  it('a transfer leaves total cash untouched', () => {
    const before = ledger()
    const after = run(before, {
      type: 'transaction/add',
      transaction: {
        kind: 'transfer',
        amount: peso(1_000),
        accountId: 'bank',
        toAccountId: 'gcash',
        date: on(0),
      },
    })
    expect(availableCash(after)).toBe(availableCash(before))
    expect(after.accounts.find((a) => a.id === 'bank')!.balance).toBe(peso(9_000))
    expect(after.accounts.find((a) => a.id === 'gcash')!.balance).toBe(peso(4_000))
  })

  it('a debt payment reduces the balance and records one history entry', () => {
    const after = run(ledger(), {
      type: 'transaction/add',
      transaction: {
        kind: 'debt_payment',
        amount: peso(2_000),
        accountId: 'bank',
        debtId: 'card',
        merchant: 'Card payment',
        date: on(0),
      },
    })
    const debt = after.debts.find((d) => d.id === 'card')!
    expect(debt.balance).toBe(peso(16_000))
    expect(debt.history).toHaveLength(1)
    expect(after.plan.items.find((i) => i.id === 'card')!.spent).toBe(peso(2_000))
  })

  it('an overpayment cannot push a debt below zero', () => {
    const after = run(ledger(), {
      type: 'transaction/add',
      transaction: {
        kind: 'debt_payment',
        amount: peso(999_999),
        accountId: 'bank',
        debtId: 'card',
        date: on(0),
      },
    })
    expect(after.debts.find((d) => d.id === 'card')!.balance).toBe(0)
  })
})

describe('deleting a transaction', () => {
  it('restores every derived number exactly', () => {
    const before = ledger()
    const added = run(before, expense())
    const id = added.transactions[0].id
    const after = run(added, { type: 'transaction/delete', id })

    expect(snapshot(after)).toEqual(snapshot(before))
    expect(after.transactions).toHaveLength(0)
  })

  it('undoes a debt payment, balance and history alike', () => {
    const before = ledger()
    const added = run(before, {
      type: 'transaction/add',
      transaction: {
        kind: 'debt_payment',
        amount: peso(2_000),
        accountId: 'bank',
        debtId: 'card',
        date: on(0),
      },
    })
    const after = run(added, { type: 'transaction/delete', id: added.transactions[0].id })
    expect(snapshot(after)).toEqual(snapshot(before))
  })

  it('removes the right history row when several payments exist', () => {
    let state = ledger()
    for (const amount of [peso(1_000), peso(2_000), peso(3_000)]) {
      state = run(state, {
        type: 'transaction/add',
        transaction: { kind: 'debt_payment', amount, accountId: 'bank', debtId: 'card', date: on(0) },
      })
    }
    // Delete the middle one — not the newest.
    const middle = state.transactions.find((t) => t.amount === peso(2_000))!
    const after = run(state, { type: 'transaction/delete', id: middle.id })

    const debt = after.debts.find((d) => d.id === 'card')!
    expect(debt.balance).toBe(peso(18_000) - peso(1_000) - peso(3_000))
    expect(debt.history).toHaveLength(2)
    expect(debt.history!.some((h) => h.amount === peso(2_000))).toBe(false)
  })

  it('ignores an id that is not there', () => {
    const before = ledger()
    expect(run(before, { type: 'transaction/delete', id: 'nope' })).toEqual(before)
  })
})

describe('editing a transaction', () => {
  it('moves both envelopes when the category changes', () => {
    const added = run(ledger(), expense())
    const id = added.transactions[0].id
    const after = run(added, {
      type: 'transaction/update',
      id,
      changes: { categoryId: 'fun' },
    })
    expect(after.plan.items.find((i) => i.id === 'food')!.spent).toBe(0)
    expect(after.plan.items.find((i) => i.id === 'fun')!.spent).toBe(peso(340))
  })

  it('moves both accounts when the account changes', () => {
    const before = ledger()
    const added = run(before, expense())
    const after = run(added, {
      type: 'transaction/update',
      id: added.transactions[0].id,
      changes: { accountId: 'bank' },
    })
    expect(after.accounts.find((a) => a.id === 'gcash')!.balance).toBe(peso(3_000))
    expect(after.accounts.find((a) => a.id === 'bank')!.balance).toBe(peso(9_660))
    // Total cash is unchanged: the money moved which pocket it left, not how much.
    expect(availableCash(after)).toBe(availableCash(added))
  })

  it('changing the amount adjusts by the difference, not by the whole amount', () => {
    const added = run(ledger(), expense())
    const after = run(added, {
      type: 'transaction/update',
      id: added.transactions[0].id,
      changes: { amount: peso(500) },
    })
    expect(after.plan.items.find((i) => i.id === 'food')!.spent).toBe(peso(500))
    expect(after.accounts.find((a) => a.id === 'gcash')!.balance).toBe(peso(2_500))
  })

  it('an edit and an edit back is a no-op', () => {
    const added = run(ledger(), expense())
    const id = added.transactions[0].id
    const there = run(added, {
      type: 'transaction/update',
      id,
      changes: { amount: peso(1_200), categoryId: 'fun', accountId: 'bank' },
    })
    const back = run(there, {
      type: 'transaction/update',
      id,
      changes: { amount: peso(340), categoryId: 'food', accountId: 'gcash' },
    })
    expect(snapshot(back)).toEqual(snapshot(added))
  })
})

describe('paying a bill', () => {
  it('marks it paid, logs a transaction, and moves the cash', () => {
    const before = ledger()
    const after = run(before, {
      type: 'bill/pay',
      billId: 'rent',
      amount: peso(8_000),
      accountId: 'bank',
    })
    const bill = after.bills.find((b) => b.id === 'rent')!
    expect(bill.status).toBe('paid')
    expect(bill.amountPaid).toBe(peso(8_000))
    expect(after.transactions).toHaveLength(1)
    expect(after.accounts.find((a) => a.id === 'bank')!.balance).toBe(peso(2_000))
    expect(after.billsOnTime.due).toBe(1)
  })

  it('a part payment leaves it partial', () => {
    const after = run(ledger(), {
      type: 'bill/pay',
      billId: 'rent',
      amount: peso(3_000),
      accountId: 'bank',
    })
    expect(after.bills.find((b) => b.id === 'rent')!.status).toBe('partial')
  })
})

describe('rolling into a new cycle', () => {
  /**
   * The old behaviour rebuilt from the demo seed whenever the stored cycle was
   * stale. Harmless while the only data was the persona's, and quietly fatal to
   * a real ledger the first time a payday passed.
   */
  it('keeps every account, transaction, debt and bill', () => {
    const state = run(ledger(), expense())
    const rolled = rollCycle(state, now)

    expect(rolled.accounts).toEqual(state.accounts)
    expect(rolled.transactions).toEqual(state.transactions)
    expect(rolled.debts).toEqual(state.debts)
    expect(rolled.profile).toEqual(state.profile)
  })

  it('resets what was spent but keeps what was planned', () => {
    const state = run(ledger(), expense())
    const rolled = rollCycle(state, now)

    expect(rolled.plan.items.map((i) => i.planned)).toEqual(state.plan.items.map((i) => i.planned))
    expect(rolled.plan.items.every((i) => i.spent === 0)).toBe(true)
  })

  it('brings a settled recurring bill back for next month', () => {
    const paid = run(ledger(), {
      type: 'bill/pay',
      billId: 'rent',
      amount: peso(8_000),
      accountId: 'bank',
    })
    // Age the bill so it sits in the past.
    paid.bills[0].dueOn = on(-40)
    const rolled = rollCycle(paid, now)

    const bill = rolled.bills.find((b) => b.id === 'rent')!
    expect(bill.status).toBe('open')
    expect(bill.amountPaid).toBe(0)
    expect(bill.dueOn > on(-40)).toBe(true)
  })

  it('leaves an unpaid bill exactly where it is', () => {
    const state = ledger()
    const rolled = rollCycle(state, now)
    expect(rolled.bills.find((b) => b.id === 'rent')).toEqual(state.bills[0])
  })

  it('dates the new cycle from the profile’s own cadence', () => {
    const monthly = ledger()
    monthly.profile.payCadence = 'monthly'
    const rolled = rollCycle(monthly, now)
    expect(rolled.plan.startsOn).toBe(toISO(currentPaydayOn('monthly', now)))
    expect(rolled.plan.endsOn).toBe(toISO(addDays(nextPaydayOn('monthly', now), -1)))
  })
})

describe('the plan', () => {
  it('never stores a negative planned amount', () => {
    const after = run(ledger(), {
      type: 'plan/setPlanned',
      itemId: 'food',
      planned: peso(-500),
    })
    expect(after.plan.items.find((i) => i.id === 'food')!.planned).toBe(0)
  })

  it('adds an envelope with a fresh id', () => {
    const after = run(ledger(), {
      type: 'plan/addItem',
      name: 'Gifts',
      emoji: '🎁',
      planned: peso(1_000),
    })
    expect(after.plan.items).toHaveLength(4)
    const added = after.plan.items.at(-1)!
    expect(added.name).toBe('Gifts')
    expect(after.plan.items.filter((i) => i.id === added.id)).toHaveLength(1)
  })
})

describe('adding and editing accounts', () => {
  it('adds one with a fresh id', () => {
    const after = run(ledger(), {
      type: 'account/add',
      account: { name: 'Maya', type: 'ewallet', balance: peso(1_500) },
    })
    expect(after.accounts).toHaveLength(4)
    expect(availableCash(after)).toBe(peso(14_500))
    expect(new Set(after.accounts.map((a) => a.id)).size).toBe(4)
  })

  it('edits without disturbing anything else', () => {
    const before = ledger()
    const after = run(before, {
      type: 'account/update',
      id: 'gcash',
      changes: { name: 'GCash (main)', balance: peso(4_000) },
    })
    expect(after.accounts.find((a) => a.id === 'gcash')!.name).toBe('GCash (main)')
    expect(availableCash(after)).toBe(availableCash(before) + peso(1_000))
    expect(after.transactions).toEqual(before.transactions)
  })

  it('refuses to delete one that transactions point at', () => {
    const state = run(ledger(), expense())
    expect(whyNotDeleteAccount(state, 'gcash')).toMatch(/entry/)

    const after = run(state, { type: 'account/delete', id: 'gcash' })
    // Refused, and refused *silently in the reducer* — the sheet shows why.
    expect(after.accounts).toHaveLength(3)
    expect(after).toEqual(state)
  })

  it('allows it once the entries are gone', () => {
    const added = run(ledger(), expense())
    const cleared = run(added, { type: 'transaction/delete', id: added.transactions[0].id })
    expect(whyNotDeleteAccount(cleared, 'gcash')).toBeNull()

    const after = run(cleared, { type: 'account/delete', id: 'gcash' })
    expect(after.accounts.map((a) => a.id)).toEqual(['bank', 'save'])
  })

  it('never lets you delete the last account', () => {
    let state = ledger()
    state = { ...state, accounts: [state.accounts[0]] }
    expect(whyNotDeleteAccount(state, 'bank')).toMatch(/kahit isa/)
    expect(run(state, { type: 'account/delete', id: 'bank' }).accounts).toHaveLength(1)
  })
})

describe('adding and editing bills', () => {
  it('adds one, open and unpaid', () => {
    const after = run(ledger(), {
      type: 'bill/add',
      bill: { name: 'Internet', amountDue: peso(1_699), dueOn: on(9), recurring: true },
    })
    const bill = after.bills.find((b) => b.name === 'Internet')!
    expect(bill.status).toBe('open')
    expect(bill.amountPaid).toBe(0)
  })

  it('raising the amount past what was paid re-opens it', () => {
    const paid = run(ledger(), {
      type: 'bill/pay',
      billId: 'rent',
      amount: peso(8_000),
      accountId: 'bank',
    })
    expect(paid.bills[0].status).toBe('paid')

    const raised = run(paid, {
      type: 'bill/update',
      id: 'rent',
      changes: { amountDue: peso(9_500) },
    })
    expect(raised.bills[0].status).toBe('partial')
  })

  it('lowering it below what was paid settles it', () => {
    const part = run(ledger(), {
      type: 'bill/pay',
      billId: 'rent',
      amount: peso(3_000),
      accountId: 'bank',
    })
    expect(part.bills[0].status).toBe('partial')

    const lowered = run(part, {
      type: 'bill/update',
      id: 'rent',
      changes: { amountDue: peso(2_000) },
    })
    expect(lowered.bills[0].status).toBe('paid')
  })

  it('deleting it takes the envelope that funded it', () => {
    const state = {
      ...ledger(),
      plan: {
        ...ledger().plan,
        items: [
          ...ledger().plan.items,
          { id: 'b:rent', name: 'Rent', emoji: '🏠', planned: peso(8_000), spent: 0, locked: true, billId: 'rent' },
        ],
      },
    }
    const after = run(state, { type: 'bill/delete', id: 'rent' })
    expect(after.bills).toHaveLength(0)
    expect(after.plan.items.some((i) => i.billId === 'rent')).toBe(false)
  })
})

describe('adding and editing debts', () => {
  const newDebt = {
    name: 'Utang kay Kuya',
    kind: 'informal' as const,
    balance: peso(5_000),
    originalAmount: peso(5_000),
    monthlyRate: 0,
    minPayment: 0,
  }

  it('adds one with an empty history', () => {
    const after = run(ledger(), { type: 'debt/add', debt: newDebt })
    expect(after.debts).toHaveLength(2)
    expect(totalDebt(after)).toBe(peso(23_000))
    expect(after.debts.at(-1)!.history).toEqual([])
  })

  it('will not let the balance exceed what was borrowed', () => {
    const after = run(ledger(), {
      type: 'debt/update',
      id: 'card',
      changes: { balance: peso(999_999) },
    })
    expect(after.debts[0].balance).toBe(peso(20_000))
  })

  it('refuses to delete one with a payment recorded against it', () => {
    const paid = run(ledger(), {
      type: 'transaction/add',
      transaction: {
        kind: 'debt_payment',
        amount: peso(1_000),
        accountId: 'bank',
        debtId: 'card',
        date: on(0),
      },
    })
    expect(whyNotDeleteDebt(paid, 'card')).toMatch(/naitala/)
    expect(run(paid, { type: 'debt/delete', id: 'card' }).debts).toHaveLength(1)
  })

  it('deleting an untouched one unhooks everything that pointed at it', () => {
    const state: AppData = {
      ...ledger(),
      accounts: [
        ...ledger().accounts,
        { id: 'visa', name: 'Visa', type: 'credit', balance: peso(-1_000), linkedDebtId: 'card' },
      ],
      bills: [{ ...ledger().bills[0], debtId: 'card' }],
    }
    const after = run(state, { type: 'debt/delete', id: 'card' })

    expect(after.debts).toHaveLength(0)
    expect(after.accounts.find((a) => a.id === 'visa')!.linkedDebtId).toBeUndefined()
    expect(after.bills[0].debtId).toBeUndefined()
    expect(after.plan.items.some((i) => i.debtId === 'card')).toBe(false)
  })
})

describe('the default account a screen should pay from', () => {
  /**
   * Bills and the debt detail used to hardcode the demo persona's 'payroll'.
   * Against a real ledger that matches nothing: the bill went to paid, a
   * transaction appeared, and no balance moved.
   */
  it('is a real spendable account, never savings or a card', () => {
    const id = defaultSpendAccountId(ledger())
    const account = ledger().accounts.find((a) => a.id === id)!
    expect(account.type).not.toBe('savings')
    expect(account.type).not.toBe('credit')
  })

  it('paying a bill through it actually moves the money', () => {
    const before = ledger()
    const after = run(before, {
      type: 'bill/pay',
      billId: 'rent',
      amount: peso(8_000),
      accountId: defaultSpendAccountId(before),
    })
    expect(availableCash(after)).toBe(availableCash(before) - peso(8_000))
  })

  it('falls back to whatever exists rather than to an empty string', () => {
    const savingsOnly: AppData = {
      ...ledger(),
      accounts: [{ id: 'save', name: 'Savings', type: 'savings', balance: peso(1_000) }],
    }
    expect(defaultSpendAccountId(savingsOnly)).toBe('save')
  })
})
