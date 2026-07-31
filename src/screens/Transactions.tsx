import { useMemo, useState } from 'react'
import { useStore } from '../state/store'
import { BackLink, Kicker } from '../components/ui'
import { TransactionSheet } from '../components/TransactionSheet'
import { formatMoney, sum } from '../lib/money'
import { formatShort, parseISO, toISO, today } from '../lib/dates'
import type { Transaction } from '../types'

type Filter = 'all' | 'out' | 'in'

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'out', label: 'Out' },
  { key: 'in', label: 'In' },
]

const isOutflow = (t: Transaction) => t.kind === 'expense' || t.kind === 'debt_payment'

/**
 * The ledger. Money arrives here from the keypad and from Bes; this is where
 * you review it, fix a wrong category, or delete the double-tap — with the
 * balance, the envelope and the debt all moving back together.
 */
export function Transactions({ onBack }: { onBack: () => void }) {
  const [data, dispatch] = useStore()
  const [filter, setFilter] = useState<Filter>('all')
  const [query, setQuery] = useState('')
  const [editing, setEditing] = useState<Transaction | null>(null)

  const now = today()
  const todayISO = toISO(now)
  const yesterdayISO = toISO(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1))

  const categoryOf = (t: Transaction) => data.categories.find((c) => c.id === t.categoryId)
  const accountOf = (t: Transaction) => data.accounts.find((a) => a.id === t.accountId)

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return data.transactions
      .filter((t) => (filter === 'all' ? true : filter === 'out' ? isOutflow(t) : !isOutflow(t)))
      .filter((t) => {
        if (!needle) return true
        const haystack = [
          t.merchant,
          t.note,
          categoryOf(t)?.name,
          accountOf(t)?.name,
          formatMoney(t.amount, { symbol: false }),
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
        return haystack.includes(needle)
      })
      .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt)
  }, [data.transactions, data.categories, data.accounts, filter, query])

  // Group by day, newest first — the header carries that day's net.
  const days = useMemo(() => {
    const buckets = new Map<string, Transaction[]>()
    for (const t of visible) {
      const list = buckets.get(t.date) ?? []
      list.push(t)
      buckets.set(t.date, list)
    }
    return [...buckets.entries()]
  }, [visible])

  const moneyOut = sum(visible.filter(isOutflow).map((t) => t.amount))
  const moneyIn = sum(visible.filter((t) => !isOutflow(t)).map((t) => t.amount))

  const dayLabel = (iso: string) =>
    iso === todayISO ? 'Today' : iso === yesterdayISO ? 'Yesterday' : formatShort(parseISO(iso))

  return (
    <div className="screen screen--pad-bottom" style={{ gap: 14 }}>
      <div className="row-center">
        <BackLink onClick={onBack}>Money</BackLink>
        <div className="seg seg--sm" role="group" aria-label="Filter">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              className="seg__opt"
              aria-pressed={filter === f.key}
              onClick={() => setFilter(f.key)}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <h1 className="h-page" style={{ margin: 0 }}>
        Activity
      </h1>

      <div className="surface-pad row-between">
        <span className="muted" style={{ fontSize: 12 }}>
          {visible.length} {visible.length === 1 ? 'entry' : 'entries'}
          {query || filter !== 'all' ? ' · filtered' : ''}
        </span>
        <span style={{ fontSize: 12.5, display: 'flex', gap: 10 }}>
          <span className="muted">out {formatMoney(moneyOut)}</span>
          <span className="positive">in {formatMoney(moneyIn)}</span>
        </span>
      </div>

      <div className="composer">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search merchant, note, category…"
          aria-label="Search transactions"
        />
        {query && (
          <button
            type="button"
            className="composer__send"
            onClick={() => setQuery('')}
            aria-label="Clear search"
          >
            ✕
          </button>
        )}
      </div>

      {days.length === 0 && (
        <div className="surface-pad muted" style={{ fontSize: 12.5 }}>
          {data.transactions.length === 0
            ? 'wala pang laman. tap the + and log something.'
            : 'walang tugma. try something else.'}
        </div>
      )}

      {days.map(([date, entries]) => {
        const net =
          sum(entries.filter((t) => !isOutflow(t)).map((t) => t.amount)) -
          sum(entries.filter(isOutflow).map((t) => t.amount))

        return (
          <section key={date} className="stack" style={{ gap: 8 }}>
            <div className="row-between">
              <Kicker tone="faint">{dayLabel(date)}</Kicker>
              <span className={net >= 0 ? 'positive' : 'muted'} style={{ fontSize: 10.5 }}>
                {formatMoney(Math.abs(net), { signed: false })} {net >= 0 ? 'in' : 'out'}
              </span>
            </div>

            {entries.map((t) => {
              const category = categoryOf(t)
              const account = accountOf(t)
              const out = isOutflow(t)
              const title =
                t.merchant ??
                category?.name ??
                (t.kind === 'transfer' ? 'Transfer' : t.kind === 'income' ? 'Income' : 'Expense')

              return (
                <button key={t.id} type="button" className="line-row" onClick={() => setEditing(t)}>
                  <span className="icon-tile">
                    {category?.emoji ?? (t.kind === 'debt_payment' ? '💳' : t.kind === 'income' ? '💼' : '↔')}
                  </span>
                  <span className="stack" style={{ flex: 1, alignItems: 'flex-start', gap: 1, minWidth: 0 }}>
                    <span style={{ fontSize: 13.5 }}>{title}</span>
                    <span className="muted" style={{ fontSize: 10.5 }}>
                      {[category?.name, account?.name, t.note, t.source === 'chat' ? 'via Bes' : null]
                        .filter(Boolean)
                        .join(' · ')}
                    </span>
                  </span>
                  <span className={`line-row__amt${out ? '' : ' positive'}`}>
                    {out ? '−' : '+'} {formatMoney(t.amount)}
                  </span>
                </button>
              )
            })}
          </section>
        )
      })}

      {editing && (
        <TransactionSheet
          mode="edit"
          initial={editing}
          onClose={() => setEditing(null)}
          onSubmit={(changes) => {
            dispatch({ type: 'transaction/update', id: editing.id, changes })
            setEditing(null)
          }}
          onDelete={() => {
            dispatch({ type: 'transaction/delete', id: editing.id })
            setEditing(null)
          }}
        />
      )}
    </div>
  )
}
