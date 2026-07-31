import { useState } from 'react'
import { useStore, whyNotDeleteAccount, whyNotDeleteDebt } from '../state/store'
import { RecordSheet } from './RecordSheet'
import { AmountInput, DayInput, Field, FieldGroup, Segmented } from './fields'
import { formatMoney, type Centavos } from '../lib/money'
import { formatShort, ordinalDay } from '../lib/dates'
import { nextDueDate } from '../data/starter'
import type { Account, AccountType, Bill, Debt, DebtKind } from '../types'

const ACCOUNT_TYPES: { key: AccountType; label: string }[] = [
  { key: 'cash', label: 'Cash' },
  { key: 'bank', label: 'Bank' },
  { key: 'ewallet', label: 'E-wallet' },
  { key: 'savings', label: 'Savings' },
]

/* ── accounts ─────────────────────────────────────────────────────────────── */

export function AccountSheet({
  account,
  onClose,
}: {
  /** Absent when adding. */
  account?: Account
  onClose: () => void
}) {
  const [data, dispatch] = useStore()
  const editing = Boolean(account)

  const [name, setName] = useState(account?.name ?? '')
  const [type, setType] = useState<AccountType>(account?.type ?? 'bank')
  const [balance, setBalance] = useState<Centavos>(account?.balance ?? 0)

  const blocked = account ? whyNotDeleteAccount(data, account.id) : null

  return (
    <RecordSheet
      title={editing ? 'Edit account' : 'New account'}
      mode={editing ? 'edit' : 'add'}
      canSave={name.trim().length > 0}
      onClose={onClose}
      onSave={() => {
        if (editing) {
          dispatch({ type: 'account/update', id: account!.id, changes: { name: name.trim(), type, balance } })
        } else {
          dispatch({ type: 'account/add', account: { name: name.trim(), type, balance } })
        }
        onClose()
      }}
      onDelete={
        account
          ? () => {
              dispatch({ type: 'account/delete', id: account.id })
              onClose()
            }
          : undefined
      }
      deleteLabel="Delete this account"
      deleteBlockedReason={blocked}
    >
      <Field label="Name">
        <input
          className="input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="BPI, GCash, wallet…"
          autoFocus
        />
      </Field>

      <FieldGroup
        label="Type"
        hint="Savings is kept out of safe-to-spend, on purpose."
      >
        <Segmented options={ACCOUNT_TYPES} value={type} onChange={setType} small />
      </FieldGroup>

      <Field label="Balance right now">
        <AmountInput value={balance} onChange={setBalance} wide />
      </Field>
    </RecordSheet>
  )
}

/* ── bills ────────────────────────────────────────────────────────────────── */

const BILL_EMOJI = ['🏠', '💡', '🚿', '📶', '📱', '🎬', '🩺', '🚌', '🧾']

export function BillSheet({ bill, onClose }: { bill?: Bill; onClose: () => void }) {
  const [, dispatch] = useStore()
  const editing = Boolean(bill)

  const [name, setName] = useState(bill?.name ?? '')
  const [emoji, setEmoji] = useState(bill?.emoji ?? '🧾')
  const [amountDue, setAmountDue] = useState<Centavos>(bill?.amountDue ?? 0)
  const [dueDay, setDueDay] = useState(
    bill ? Number(bill.dueOn.slice(8, 10)) : 15,
  )

  return (
    <RecordSheet
      title={editing ? 'Edit bill' : 'New bill'}
      mode={editing ? 'edit' : 'add'}
      canSave={name.trim().length > 0 && amountDue > 0}
      onClose={onClose}
      onSave={() => {
        if (editing) {
          dispatch({
            type: 'bill/update',
            id: bill!.id,
            changes: {
              name: name.trim(),
              emoji,
              amountDue,
              // Keep the month, move the day — an edit should not silently
              // push a bill you already have into next month.
              dueOn: bill!.dueOn.slice(0, 8) + String(Math.min(dueDay, 28)).padStart(2, '0'),
            },
          })
        } else {
          dispatch({
            type: 'bill/add',
            bill: {
              name: name.trim(),
              emoji,
              amountDue,
              dueOn: toISODate(nextDueDate(dueDay)),
              recurring: true,
            },
          })
        }
        onClose()
      }}
      onDelete={
        bill
          ? () => {
              dispatch({ type: 'bill/delete', id: bill.id })
              onClose()
            }
          : undefined
      }
      deleteLabel="Delete this bill"
    >
      <Field label="Name">
        <input
          className="input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Meralco, rent, internet…"
          autoFocus
        />
      </Field>

      <FieldGroup label="Icon">
        <div className="emoji-row">
          {BILL_EMOJI.map((e) => (
            <button
              key={e}
              type="button"
              className="emoji-pick"
              aria-pressed={emoji === e}
              aria-label={e}
              onClick={() => setEmoji(e)}
            >
              {e}
            </button>
          ))}
        </div>
      </FieldGroup>

      <Field label="Amount">
        <AmountInput value={amountDue} onChange={setAmountDue} wide />
      </Field>

      <FieldGroup
        label="Due day of the month"
        hint={`${ordinalDay(dueDay)} · next ${formatShort(nextDueDate(dueDay))}`}
      >
        <DayInput value={dueDay} onChange={setDueDay} />
      </FieldGroup>
    </RecordSheet>
  )
}

/** Local ISO, avoiding the UTC shift `toISOString` would apply. */
function toISODate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate(),
  ).padStart(2, '0')}`
}

/* ── debts ────────────────────────────────────────────────────────────────── */

const DEBT_KINDS: { key: DebtKind; label: string }[] = [
  { key: 'card', label: 'Card' },
  { key: 'loan', label: 'Loan' },
  { key: 'installment', label: 'Instalment' },
  { key: 'informal', label: 'Kay kuya' },
]

export function DebtSheet({ debt, onClose }: { debt?: Debt; onClose: () => void }) {
  const [data, dispatch] = useStore()
  const editing = Boolean(debt)

  const [name, setName] = useState(debt?.name ?? '')
  const [kind, setKind] = useState<DebtKind>(debt?.kind ?? 'card')
  const [balance, setBalance] = useState<Centavos>(debt?.balance ?? 0)
  const [originalAmount, setOriginalAmount] = useState<Centavos>(
    debt?.originalAmount ?? 0,
  )
  const [ratePct, setRatePct] = useState(String((debt?.monthlyRate ?? 0) * 100 || ''))
  const [minPayment, setMinPayment] = useState<Centavos>(debt?.minPayment ?? 0)
  const [dueDay, setDueDay] = useState(debt?.dueDay ?? 15)
  const [note, setNote] = useState(debt?.note ?? '')

  // An informal debt between friends does not accrue interest, and pretending
  // otherwise would put a made-up number into the payoff projection.
  const informal = kind === 'informal'
  const monthlyRate = informal ? 0 : (Number(ratePct.replace(',', '.')) || 0) / 100
  const original = originalAmount > 0 ? originalAmount : balance
  const blocked = debt ? whyNotDeleteDebt(data, debt.id) : null

  return (
    <RecordSheet
      title={editing ? 'Edit debt' : 'New debt'}
      mode={editing ? 'edit' : 'add'}
      canSave={name.trim().length > 0 && balance > 0}
      onClose={onClose}
      onSave={() => {
        const fields = {
          name: name.trim(),
          kind,
          balance,
          originalAmount: original,
          monthlyRate,
          minPayment,
          dueDay: informal ? undefined : dueDay,
          note: note.trim() || undefined,
        }
        if (editing) dispatch({ type: 'debt/update', id: debt!.id, changes: fields })
        else dispatch({ type: 'debt/add', debt: fields })
        onClose()
      }}
      onDelete={
        debt
          ? () => {
              dispatch({ type: 'debt/delete', id: debt.id })
              onClose()
            }
          : undefined
      }
      deleteLabel="Delete this debt"
      deleteBlockedReason={blocked}
    >
      <Field label="Who or what">
        <input
          className="input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="BPI card, Utang kay Kuya…"
          autoFocus
        />
      </Field>

      <FieldGroup label="Kind">
        <Segmented options={DEBT_KINDS} value={kind} onChange={setKind} small />
      </FieldGroup>

      <Field label="Balance you owe now">
        <AmountInput value={balance} onChange={setBalance} wide />
      </Field>

      <Field
        label="Originally borrowed"
        hint={
          originalAmount > 0
            ? 'Used for the progress bar only.'
            : `Leave blank and I’ll use ${formatMoney(balance)} — progress starts at zero.`
        }
      >
        <AmountInput value={originalAmount} onChange={setOriginalAmount} wide />
      </Field>

      {!informal && (
        <>
          <Field
            label="Interest per month"
            hint="A card statement usually says 3%. Leave at 0 if there is none."
          >
            <span className="field__money" style={{ width: '100%' }}>
              <input
                className="input input--money"
                inputMode="decimal"
                placeholder="0"
                value={ratePct}
                onChange={(e) => setRatePct(e.target.value.replace(/[^\d.,]/g, ''))}
              />
              <span className="field__peso">%</span>
            </span>
          </Field>

          <Field label="Minimum payment">
            <AmountInput value={minPayment} onChange={setMinPayment} wide />
          </Field>

          <FieldGroup label="Due day of the month" hint={ordinalDay(dueDay)}>
            <DayInput value={dueDay} onChange={setDueDay} />
          </FieldGroup>
        </>
      )}

      <Field label="Note" hint="Optional — “walang interest, basta may hangganan”">
        <input
          className="input"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Anything worth remembering"
        />
      </Field>

      {!informal && minPayment > 0 && monthlyRate > 0 && minPayment <= balance * monthlyRate && (
        <div className="surface-pad" style={{ fontSize: 11.5, color: 'var(--p-danger)', lineHeight: 1.45 }}>
          heads up: {formatMoney(minPayment)} a month is less than the{' '}
          {formatMoney(Math.round(balance * monthlyRate))} interest. sa minimum lang, lalaki ito
          habambuhay.
        </div>
      )}
    </RecordSheet>
  )
}
