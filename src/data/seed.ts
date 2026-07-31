/**
 * "Dafhnee" — the invented persona the mockups were designed around:
 * semi-monthly salary ₱25,000, four debts, ₱46,900 owed.
 *
 * Dates are anchored to *today* rather than hard-coded, so the app always
 * reads the way the mockups do: a bill 2 days overdue, Meralco in 3 days,
 * the card minimum in 5, payday at the end of the cycle.
 */

import type { AppData } from '../types'
import { peso } from '../lib/money'
import { addDays, currentPayday, nextPayday, toISO, today } from '../lib/dates'

const now = today()
const cycleStart = currentPayday(now)
const payday = nextPayday(now)
const cycleEnd = addDays(payday, -1)

/** The 30th (or month-end) of whichever month comes next. */
function nextMonthEnd(from: Date = now): Date {
  const endOfThis = new Date(from.getFullYear(), from.getMonth() + 1, 0)
  return endOfThis > from ? endOfThis : new Date(from.getFullYear(), from.getMonth() + 2, 0)
}

const monthLabel = (offset: number) =>
  new Date(now.getFullYear(), now.getMonth() + offset, 1).toLocaleDateString('en-PH', {
    month: 'short',
  })

export function createSeedData(): AppData {
  return {
    profile: {
      name: 'Dafhnee',
      salary: peso(25_000),
      payCadence: 'semi-monthly',
      personality: 'balanced',
      reactionsOn: true,
      // Dafhnee's own cushion — the blueprint's default is ₱500; she keeps more.
      safeToSpendBuffer: peso(1_500),
      theme: 'sorbetes',
      matchSystemTheme: false,
      onboarded: false,
    },

    accounts: [
      { id: 'payroll', name: 'BPI Payroll', type: 'bank', balance: peso(11_240) },
      { id: 'gcash', name: 'GCash', type: 'ewallet', balance: peso(5_180) },
      { id: 'wallet', name: 'Wallet cash', type: 'cash', balance: peso(1_900) },
      { id: 'savings', name: 'Savings', type: 'savings', balance: peso(6_500) },
      { id: 'bpi-card', name: 'BPI Amore card', type: 'credit', balance: peso(-18_400), linkedDebtId: 'bpi' },
    ],

    categories: [
      { id: 'food', name: 'Food', emoji: '🍜', kind: 'expense', essential: true },
      { id: 'transpo', name: 'Transpo', emoji: '🚌', kind: 'expense', essential: true },
      { id: 'grocery', name: 'Grocery', emoji: '🛒', kind: 'expense', essential: true },
      { id: 'fun', name: 'Fun', emoji: '🎬', kind: 'expense' },
      { id: 'utilities', name: 'Utilities', emoji: '💡', kind: 'expense', essential: true },
      { id: 'home', name: 'Home', emoji: '🏠', kind: 'expense', essential: true },
      { id: 'family', name: 'Family', emoji: '👪', kind: 'expense', essential: true },
      { id: 'health', name: 'Health', emoji: '🩺', kind: 'expense', essential: true },
      { id: 'shopping', name: 'Shopping', emoji: '🛍️', kind: 'expense' },
      { id: 'salary', name: 'Salary', emoji: '💼', kind: 'income' },
    ],

    transactions: [
      {
        id: 't-salary',
        kind: 'income',
        amount: peso(25_000),
        categoryId: 'salary',
        accountId: 'payroll',
        merchant: 'Payroll',
        date: toISO(cycleStart),
        createdAt: cycleStart.getTime(),
      },
      {
        id: 't-1',
        kind: 'expense',
        amount: peso(340),
        categoryId: 'food',
        accountId: 'gcash',
        merchant: 'Jollibee',
        date: toISO(addDays(now, -1)),
        createdAt: addDays(now, -1).getTime(),
      },
      {
        id: 't-2',
        kind: 'expense',
        amount: peso(180),
        categoryId: 'transpo',
        accountId: 'gcash',
        merchant: 'Grab',
        date: toISO(addDays(now, -1)),
        createdAt: addDays(now, -1).getTime() + 1,
      },
      {
        id: 't-3',
        kind: 'expense',
        amount: peso(1_240),
        categoryId: 'grocery',
        accountId: 'payroll',
        merchant: 'Puregold',
        date: toISO(addDays(now, -3)),
        createdAt: addDays(now, -3).getTime(),
      },
      {
        id: 't-4',
        kind: 'expense',
        amount: peso(1_100),
        categoryId: 'fun',
        accountId: 'gcash',
        merchant: 'Concert tickets',
        date: toISO(addDays(now, -5)),
        createdAt: addDays(now, -5).getTime(),
      },
      {
        id: 't-5',
        kind: 'debt_payment',
        amount: peso(5_200),
        accountId: 'payroll',
        debtId: 'bpi',
        merchant: 'BPI Amore card',
        date: toISO(addDays(now, -16)),
        createdAt: addDays(now, -16).getTime(),
      },
    ],

    debts: [
      {
        id: 'bpi',
        name: 'BPI Amore card',
        kind: 'card',
        balance: peso(18_400),
        originalAmount: peso(30_000),
        monthlyRate: 0.03,
        minPayment: peso(3_200),
        dueDay: 5,
        creditLimit: peso(50_000),
        cadence: 'monthly',
        history: [
          {
            id: 'h1',
            date: toISO(addDays(now, -16)),
            label: 'from BPI Payroll',
            amount: peso(5_200),
            kind: 'payment',
          },
          {
            id: 'h2',
            date: toISO(addDays(now, -31)),
            label: 'from BPI Payroll',
            amount: peso(3_200),
            kind: 'payment',
          },
          {
            id: 'h3',
            date: toISO(addDays(now, -49)),
            label: 'card purchase — Lazada',
            amount: peso(2_340),
            kind: 'charge',
          },
          {
            id: 'h4',
            date: toISO(addDays(now, -56)),
            label: 'statement sync',
            amount: peso(410),
            kind: 'adjustment',
          },
        ],
      },
      {
        id: 'sss',
        name: 'SSS salary loan',
        kind: 'loan',
        balance: peso(18_700),
        originalAmount: peso(24_000),
        monthlyRate: 0.0083,
        minPayment: peso(1_050),
        cadence: 'semi-monthly',
        note: 'semi-monthly · 0.83%/mo',
      },
      {
        id: 'shopee',
        name: 'Shopee installment — phone',
        kind: 'installment',
        balance: peso(4_800),
        originalAmount: peso(7_200),
        monthlyRate: 0,
        minPayment: peso(1_200),
        dueDay: 30,
        termsPaid: 2,
        termsTotal: 6,
        cadence: 'monthly',
        note: 'no interest',
      },
      {
        id: 'kuya',
        name: 'Utang kay Kuya',
        kind: 'informal',
        balance: peso(5_000),
        originalAmount: peso(5_000),
        monthlyRate: 0,
        minPayment: 0,
        cadence: 'monthly',
        note: 'flexible · no interest · no nagging',
      },
      {
        id: 'homecredit',
        name: 'Home Credit — laptop',
        kind: 'installment',
        balance: 0,
        originalAmount: peso(21_600),
        monthlyRate: 0,
        minPayment: 0,
        clearedOn: toISO(addDays(now, -80)),
      },
    ],

    bills: [
      {
        id: 'pldt',
        name: 'PLDT Home fiber',
        amountDue: peso(1_699),
        amountPaid: peso(299),
        dueOn: toISO(addDays(now, -2)),
        status: 'partial',
        emoji: '🌐',
        recurring: true,
      },
      {
        id: 'meralco',
        name: 'Meralco',
        amountDue: peso(2_500),
        amountPaid: 0,
        dueOn: toISO(addDays(now, 3)),
        status: 'open',
        emoji: '⚡',
        hint: 'usually ~₱2,300',
        recurring: true,
      },
      {
        id: 'bpi-min',
        name: 'BPI card minimum',
        amountDue: peso(3_200),
        amountPaid: 0,
        dueOn: toISO(addDays(now, 5)),
        status: 'open',
        emoji: '💳',
        hint: 'pays the card debt too',
        debtId: 'bpi',
        recurring: true,
      },
      {
        id: 'netflix',
        name: 'Netflix',
        amountDue: peso(549),
        amountPaid: 0,
        dueOn: toISO(addDays(now, 10)),
        status: 'open',
        emoji: '📺',
        recurring: true,
      },
      {
        id: 'sss-due',
        name: 'SSS loan (semi-monthly)',
        amountDue: peso(1_050),
        amountPaid: 0,
        dueOn: toISO(payday),
        status: 'open',
        emoji: '🏛️',
        debtId: 'sss',
        recurring: true,
      },
      {
        id: 'rent',
        name: 'Rent',
        amountDue: peso(8_000),
        amountPaid: 0,
        dueOn: toISO(nextMonthEnd()),
        status: 'open',
        emoji: '🏠',
        recurring: true,
      },
      {
        id: 'shopee-3',
        name: 'Shopee installment 3/6',
        amountDue: peso(1_200),
        amountPaid: 0,
        dueOn: toISO(nextMonthEnd()),
        status: 'open',
        emoji: '📦',
        debtId: 'shopee',
        recurring: true,
      },
    ],

    plan: {
      id: 'plan-current',
      label: `${cycleStart.toLocaleDateString('en-PH', { month: 'long', day: 'numeric' })} salary`,
      total: peso(25_000),
      startsOn: toISO(cycleStart),
      endsOn: toISO(cycleEnd),
      items: [
        {
          id: 'rent',
          name: 'Rent',
          emoji: '🏠',
          planned: peso(8_000),
          spent: 0,
          essential: true,
          locked: true,
          note: 'essential',
          billId: 'rent',
        },
        {
          id: 'food',
          name: 'Food',
          emoji: '🍜',
          planned: peso(6_000),
          spent: peso(4_200),
          essential: true,
          note: 'usual ₱5,800',
          categoryId: 'food',
        },
        {
          id: 'bpi-min',
          name: 'BPI card minimum',
          emoji: '💳',
          planned: peso(3_200),
          spent: 0,
          locked: true,
          note: 'funded fully',
          billId: 'bpi-min',
          debtId: 'bpi',
        },
        {
          id: 'transpo',
          name: 'Transpo',
          emoji: '🚌',
          planned: peso(2_500),
          spent: peso(1_500),
          essential: true,
          categoryId: 'transpo',
        },
        {
          id: 'emergency',
          name: 'Emergency fund',
          emoji: '🛟',
          planned: peso(2_500),
          spent: 0,
          suggested: true,
          note: '10% of income — suggested',
        },
        {
          id: 'extra-bpi',
          name: 'Extra to BPI card',
          emoji: '💜',
          planned: peso(2_000),
          spent: 0,
          debtId: 'bpi',
        },
        {
          id: 'fun',
          name: 'Fun money',
          emoji: '🎬',
          planned: peso(800),
          spent: peso(1_100),
          categoryId: 'fun',
        },
      ],
    },

    goals: [
      {
        id: 'emergency-goal',
        name: 'Emergency fund',
        saved: peso(6_500),
        target: peso(50_000),
      },
    ],

    monthlyFlow: [
      { label: monthLabel(-2), moneyIn: peso(50_000), moneyOut: peso(44_000) },
      { label: monthLabel(-1), moneyIn: peso(50_000), moneyOut: peso(48_500) },
      { label: monthLabel(0), moneyIn: peso(50_000), moneyOut: peso(46_150) },
    ],

    billsOnTime: { paidOnTime: 34, due: 40 },
  }
}
