import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  type Dispatch,
  type ReactNode,
} from 'react'
import type { AppData, Personality, ThemeId, Transaction } from '../types'
import type { Centavos } from '../lib/money'
import { clampZero } from '../lib/money'
import { createSeedData } from '../data/seed'
import { createStarterData, type SetupAnswers } from '../data/starter'
import { addDays, currentPaydayOn, nextPaydayOn, parseISO, toISO, today } from '../lib/dates'

const STORAGE_KEY = 'piso.state.v1'

export type Action =
  | { type: 'transaction/add'; transaction: Omit<Transaction, 'id' | 'createdAt'> }
  | { type: 'transaction/update'; id: string; changes: Partial<Omit<Transaction, 'id' | 'createdAt'>> }
  | { type: 'transaction/delete'; id: string }
  | { type: 'bill/pay'; billId: string; amount: Centavos; accountId: string }
  | { type: 'plan/setPlanned'; itemId: string; planned: Centavos }
  | { type: 'plan/addItem'; name: string; emoji: string; planned: Centavos }
  | { type: 'profile/personality'; personality: Personality }
  | { type: 'profile/reactions'; on: boolean }
  | { type: 'profile/theme'; theme: ThemeId }
  | { type: 'profile/matchSystem'; on: boolean }
  | { type: 'profile/buffer'; buffer: Centavos }
  | { type: 'profile/onboarded' }
  /** Onboarding finished: replace the demo persona with the real answers. */
  | { type: 'data/setup'; answers: SetupAnswers }
  /** Back to Dafhnee — the demo, for when you want to look around. */
  | { type: 'data/reset' }
  /** Wipe and run onboarding again, keeping nothing. */
  | { type: 'data/restart' }

const nextId = (prefix: string) =>
  `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`

/**
 * Applying a transaction and un-applying it are the same arithmetic with the
 * sign flipped, so both go through here. That is what makes a delete or an
 * edit safe: the account balance, the envelope's spent, and the debt balance
 * can never move without each other (blueprint §9, §12.20).
 */
function applyEffects(state: AppData, t: Transaction, sign: 1 | -1): AppData {
  const delta = t.amount * sign

  const accounts = state.accounts.map((a) => {
    if (a.id === t.accountId) {
      if (t.kind === 'income') return { ...a, balance: a.balance + delta }
      return { ...a, balance: a.balance - delta }
    }
    if (a.id === t.toAccountId && t.kind === 'transfer') {
      return { ...a, balance: a.balance + delta }
    }
    // Paying a card reduces what the card account owes.
    if (t.kind === 'debt_payment' && a.linkedDebtId && a.linkedDebtId === t.debtId) {
      return { ...a, balance: Math.min(0, a.balance + delta) }
    }
    return a
  })

  const plan = {
    ...state.plan,
    items: state.plan.items.map((item) => {
      const matchesCategory = t.categoryId && item.categoryId === t.categoryId
      const matchesDebt = t.kind === 'debt_payment' && t.debtId && item.debtId === t.debtId
      return matchesCategory || matchesDebt
        ? { ...item, spent: clampZero(item.spent + delta) }
        : item
    }),
  }

  const debts =
    t.kind === 'debt_payment' && t.debtId
      ? state.debts.map((d) => {
          if (d.id !== t.debtId) return d
          // The history entry is keyed to the transaction, so reversing removes
          // exactly the entry this transaction added — not the newest one.
          const entryId = `h:${t.id}`
          const history =
            sign === 1
              ? [
                  {
                    id: entryId,
                    date: t.date,
                    label: t.merchant ?? 'payment',
                    amount: t.amount,
                    kind: 'payment' as const,
                  },
                  ...(d.history ?? []),
                ]
              : (d.history ?? []).filter((h) => h.id !== entryId)

          return {
            ...d,
            // Clamped — a payment can never push a balance below zero, and
            // reversing can never push it past the original amount.
            balance: clampZero(Math.min(d.originalAmount, d.balance - delta)),
            termsPaid: d.termsTotal
              ? Math.max(0, Math.min(d.termsTotal, (d.termsPaid ?? 0) + sign))
              : d.termsPaid,
            history,
          }
        })
      : state.debts

  return { ...state, accounts, plan, debts }
}

/**
 * Every mutation with side effects runs here, in one place.
 */
export function reducer(state: AppData, action: Action): AppData {
  switch (action.type) {
    case 'transaction/add': {
      const t: Transaction = {
        ...action.transaction,
        id: nextId('t'),
        createdAt: Date.now(),
      }
      const applied = applyEffects(state, t, 1)
      return { ...applied, transactions: [t, ...applied.transactions] }
    }

    case 'transaction/update': {
      const existing = state.transactions.find((t) => t.id === action.id)
      if (!existing) return state

      const updated: Transaction = { ...existing, ...action.changes, id: existing.id }
      // Un-apply the old shape, then apply the new one — an edit that changes
      // the category, account or amount moves every derived number with it.
      const reverted = applyEffects(state, existing, -1)
      const applied = applyEffects(reverted, updated, 1)

      return {
        ...applied,
        transactions: applied.transactions.map((t) => (t.id === updated.id ? updated : t)),
      }
    }

    case 'transaction/delete': {
      const existing = state.transactions.find((t) => t.id === action.id)
      if (!existing) return state
      const reverted = applyEffects(state, existing, -1)
      return {
        ...reverted,
        transactions: reverted.transactions.filter((t) => t.id !== existing.id),
      }
    }

    case 'bill/pay': {
      const bill = state.bills.find((b) => b.id === action.billId)
      if (!bill) return state

      const paid = bill.amountPaid + action.amount
      const bills = state.bills.map((b) =>
        b.id === action.billId
          ? {
              ...b,
              amountPaid: paid,
              status: paid >= b.amountDue ? ('paid' as const) : ('partial' as const),
            }
          : b,
      )

      const withTransaction = reducer(
        { ...state, bills },
        {
          type: 'transaction/add',
          transaction: {
            kind: bill.debtId ? 'debt_payment' : 'expense',
            amount: action.amount,
            accountId: action.accountId,
            debtId: bill.debtId,
            merchant: bill.name,
            date: toISO(today()),
            source: 'keypad',
          },
        },
      )

      return {
        ...withTransaction,
        billsOnTime: {
          ...withTransaction.billsOnTime,
          paidOnTime: withTransaction.billsOnTime.paidOnTime + 1,
          due: withTransaction.billsOnTime.due + 1,
        },
      }
    }

    case 'plan/setPlanned':
      return {
        ...state,
        plan: {
          ...state.plan,
          items: state.plan.items.map((i) =>
            i.id === action.itemId ? { ...i, planned: clampZero(action.planned) } : i,
          ),
        },
      }

    case 'plan/addItem':
      return {
        ...state,
        plan: {
          ...state.plan,
          items: [
            ...state.plan.items,
            {
              id: nextId('item'),
              name: action.name,
              emoji: action.emoji,
              planned: action.planned,
              spent: 0,
            },
          ],
        },
      }

    case 'profile/personality':
      return { ...state, profile: { ...state.profile, personality: action.personality } }

    case 'profile/reactions':
      return { ...state, profile: { ...state.profile, reactionsOn: action.on } }

    case 'profile/theme':
      return { ...state, profile: { ...state.profile, theme: action.theme } }

    case 'profile/matchSystem':
      return { ...state, profile: { ...state.profile, matchSystemTheme: action.on } }

    case 'profile/buffer':
      return { ...state, profile: { ...state.profile, safeToSpendBuffer: action.buffer } }

    case 'profile/onboarded':
      return { ...state, profile: { ...state.profile, onboarded: true } }

    case 'data/setup': {
      // The personality question comes after this step, so whatever was
      // already picked survives; everything else is replaced outright.
      const next = createStarterData(action.answers)
      return {
        ...next,
        profile: {
          ...next.profile,
          personality: state.profile.personality,
          reactionsOn: state.profile.reactionsOn,
          theme: state.profile.theme,
          matchSystemTheme: state.profile.matchSystemTheme,
        },
      }
    }

    case 'data/reset':
      return createSeedData()

    case 'data/restart': {
      const fresh = createSeedData()
      return { ...fresh, profile: { ...fresh.profile, onboarded: false } }
    }

    default:
      return state
  }
}

/**
 * A new payday has arrived since this state was saved: start the next cycle
 * without losing anything. Envelopes keep what you planned and reset what you
 * spent; recurring bills you already settled come back for the next month.
 *
 * The old behaviour here was to rebuild from the demo seed, which was harmless
 * while the only data was Dafhnee's and would have silently destroyed a real
 * ledger the first time a cycle rolled over.
 */
export function rollCycle(data: AppData, now: Date): AppData {
  const cadence = data.profile.payCadence
  const start = currentPaydayOn(cadence, now)
  const end = addDays(nextPaydayOn(cadence, now), -1)

  const bills = data.bills.map((b) => {
    if (!b.recurring || b.status !== 'paid') return b
    const due = parseISO(b.dueOn)
    if (due >= now) return b
    const last = new Date(due.getFullYear(), due.getMonth() + 2, 0).getDate()
    const rolled = new Date(due.getFullYear(), due.getMonth() + 1, Math.min(due.getDate(), last))
    return { ...b, dueOn: toISO(rolled), amountPaid: 0, status: 'open' as const }
  })

  return {
    ...data,
    bills,
    plan: {
      ...data.plan,
      label: `${start.toLocaleDateString('en-PH', { month: 'long', day: 'numeric' })} salary`,
      startsOn: toISO(start),
      endsOn: toISO(end),
      items: data.plan.items.map((i) => ({ ...i, spent: 0 })),
    },
  }
}

function loadInitial(): AppData {
  if (typeof window === 'undefined') return createSeedData()
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return createSeedData()
    const parsed = JSON.parse(raw) as AppData
    if (!parsed?.plan?.startsOn) return createSeedData()

    const now = today()
    const start = toISO(currentPaydayOn(parsed.profile?.payCadence ?? 'semi-monthly', now))
    if (parsed.plan.startsOn !== start) return rollCycle(parsed, now)
    return parsed
  } catch {
    return createSeedData()
  }
}

const StateContext = createContext<AppData | null>(null)
const DispatchContext = createContext<Dispatch<Action> | null>(null)

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, loadInitial)

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
    } catch {
      /* private mode / quota — the app still works, it just won't persist */
    }
  }, [state])

  return (
    <StateContext.Provider value={state}>
      <DispatchContext.Provider value={dispatch}>{children}</DispatchContext.Provider>
    </StateContext.Provider>
  )
}

export function useData(): AppData {
  const value = useContext(StateContext)
  if (!value) throw new Error('useData must be used inside <StoreProvider>')
  return value
}

export function useDispatch(): Dispatch<Action> {
  const value = useContext(DispatchContext)
  if (!value) throw new Error('useDispatch must be used inside <StoreProvider>')
  return value
}

/** Convenience for the many screens that want both. */
export function useStore(): [AppData, Dispatch<Action>] {
  return [useData(), useDispatch()]
}

export function useProfile() {
  const data = useData()
  return useMemo(() => data.profile, [data.profile])
}
