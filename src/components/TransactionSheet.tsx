import { useEffect, useMemo, useRef, useState } from 'react'
import { useData } from '../state/store'
import { formatMoney, parseAmount, toPesos } from '../lib/money'
import type { Transaction, TransactionKind } from '../types'

const KINDS: { key: TransactionKind; label: string }[] = [
  { key: 'expense', label: 'Expense' },
  { key: 'income', label: 'Income' },
  { key: 'transfer', label: 'Transfer' },
  { key: 'debt_payment', label: 'Pay debt' },
]

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', '⌫']

export type TransactionDraft = Omit<Transaction, 'id' | 'createdAt'>

/**
 * The quick-add sheet (design 1b), used twice: once to add, once to edit an
 * existing entry. Same keypad, same category grid, same account chips — an
 * edit is just the sheet opened with values in it and a Delete underneath.
 */
export function TransactionSheet({
  mode,
  initial,
  onSubmit,
  onDelete,
  onClose,
}: {
  mode: 'add' | 'edit'
  initial?: Transaction
  onSubmit: (draft: TransactionDraft) => void
  onDelete?: () => void
  onClose: () => void
}) {
  const data = useData()

  const [kind, setKind] = useState<TransactionKind>(initial?.kind ?? 'expense')
  const [raw, setRaw] = useState(initial ? String(toPesos(initial.amount)) : '')
  const [categoryId, setCategoryId] = useState(initial?.categoryId ?? 'food')
  const [accountId, setAccountId] = useState(initial?.accountId ?? 'gcash')
  const [debtId, setDebtId] = useState(
    initial?.debtId ?? data.debts.find((d) => !d.clearedOn)?.id ?? '',
  )
  const [note, setNote] = useState(initial?.note ?? '')
  const [showMore, setShowMore] = useState(Boolean(initial?.categoryId))
  const [taps, setTaps] = useState(0)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const sheetRef = useRef<HTMLDivElement>(null)

  const amount = parseAmount(raw)

  const categories = useMemo(
    () =>
      data.categories.filter((c) => (kind === 'income' ? c.kind === 'income' : c.kind === 'expense')),
    [data.categories, kind],
  )
  const visible = showMore ? categories : categories.slice(0, 7)

  const spendAccounts = data.accounts.filter(
    (a) => a.type === 'cash' || a.type === 'bank' || a.type === 'ewallet',
  )
  const debts = data.debts.filter((d) => !d.clearedOn)

  function press(key: string) {
    setTaps((t) => t + 1)
    setRaw((current) => {
      if (key === '⌫') return current.slice(0, -1)
      if (key === '.') return current.includes('.') ? current : (current || '0') + '.'
      const [, fraction] = current.split('.')
      if (fraction && fraction.length >= 2) return current
      if (current === '0') return key
      return current + key
    })
  }

  function submit() {
    if (amount <= 0) return
    onSubmit({
      kind,
      amount,
      categoryId: kind === 'expense' || kind === 'income' ? categoryId : undefined,
      accountId,
      debtId: kind === 'debt_payment' ? debtId : undefined,
      merchant:
        kind === 'debt_payment' ? debts.find((d) => d.id === debtId)?.name : initial?.merchant,
      note: note.trim() || undefined,
      date: initial?.date ?? new Date().toISOString().slice(0, 10),
      source: initial?.source ?? 'keypad',
    })
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      if (target?.tagName === 'INPUT') {
        if (e.key === 'Escape') onClose()
        return
      }
      if (e.key === 'Escape') onClose()
      if (/^[0-9]$/.test(e.key)) press(e.key)
      if (e.key === '.') press('.')
      if (e.key === 'Backspace') press('⌫')
      if (e.key === 'Enter' && amount > 0) submit()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  return (
    <div
      className="sheet-scrim"
      role="dialog"
      aria-modal="true"
      aria-label={mode === 'add' ? 'Quick add' : 'Edit transaction'}
      onMouseDown={(e) => {
        if (!sheetRef.current?.contains(e.target as Node)) onClose()
      }}
    >
      <div className="sheet" ref={sheetRef}>
        <div className="sheet__grip" />

        <div className="seg" role="group" aria-label="Entry type">
          {KINDS.map((k) => (
            <button
              key={k.key}
              type="button"
              className="seg__opt"
              aria-pressed={kind === k.key}
              onClick={() => setKind(k.key)}
            >
              {k.label}
            </button>
          ))}
        </div>

        <div className="amount-display">
          <span className="amount-display__peso">₱</span>
          <span className="amount-display__value">{raw || '0'}</span>
          <span className="amount-display__caret" />
        </div>

        {(kind === 'expense' || kind === 'income') && (
          <div className="cat-grid">
            {visible.map((c) => (
              <button
                key={c.id}
                type="button"
                className="cat"
                aria-pressed={categoryId === c.id}
                onClick={() => {
                  setCategoryId(c.id)
                  setTaps((t) => t + 1)
                }}
              >
                <span className="cat__emoji">{c.emoji}</span>
                {c.name}
              </button>
            ))}
            {!showMore && categories.length > 7 && (
              <button type="button" className="cat" onClick={() => setShowMore(true)}>
                •••<span>more</span>
              </button>
            )}
          </div>
        )}

        {kind === 'debt_payment' && (
          <div className="cat-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
            {debts.map((d) => (
              <button
                key={d.id}
                type="button"
                className="cat"
                aria-pressed={debtId === d.id}
                onClick={() => setDebtId(d.id)}
                style={{ padding: '10px 8px' }}
              >
                {d.name}
              </button>
            ))}
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {spendAccounts.map((a) => (
            <button
              key={a.id}
              type="button"
              className="pill"
              aria-pressed={accountId === a.id}
              onClick={() => setAccountId(a.id)}
            >
              {a.name}
            </button>
          ))}
        </div>

        <input
          className="note-line"
          placeholder="+ note · date (today)"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          aria-label="Note"
        />

        <div className="keypad">
          {KEYS.map((k) => (
            <button
              key={k}
              type="button"
              className={k === '.' || k === '⌫' ? 'keypad__alt' : undefined}
              onClick={() => press(k)}
              aria-label={k === '⌫' ? 'Delete' : k}
            >
              {k}
            </button>
          ))}
        </div>

        <button type="button" className="btn-outline" onClick={submit} disabled={amount <= 0}>
          {mode === 'add' ? (
            <>
              {amount > 0 ? `Save ${formatMoney(amount)}` : 'Save'} — {taps}{' '}
              {taps === 1 ? 'tap' : 'taps'} so far
            </>
          ) : (
            `Save changes${amount > 0 ? ` — ${formatMoney(amount)}` : ''}`
          )}
        </button>

        {mode === 'edit' && onDelete && (
          <button
            type="button"
            className="btn-quiet"
            style={confirmingDelete ? { color: 'var(--p-danger)', borderColor: 'var(--p-danger)' } : undefined}
            onClick={() => (confirmingDelete ? onDelete() : setConfirmingDelete(true))}
          >
            {confirmingDelete ? 'Sigurado? Tap again to delete' : 'Delete this entry'}
          </button>
        )}
      </div>
    </div>
  )
}
