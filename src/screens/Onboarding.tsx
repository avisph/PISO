import { useState } from 'react'
import { useStore } from '../state/store'
import { Kicker, RadioDot, Switch } from '../components/ui'
import { formatMoney, parseAmount, type Centavos } from '../lib/money'
import { formatShort, ordinalDay } from '../lib/dates'
import {
  COMMON_BILLS,
  DEFAULT_ACCOUNTS,
  nextDueDate,
  type AccountAnswer,
  type BillAnswer,
  type SetupAnswers,
} from '../data/starter'
import type { AccountType, Personality } from '../types'

export const PERSONALITIES: {
  key: Personality
  name: string
  sample: string
  recommended?: boolean
}[] = [
  {
    key: 'gentle',
    name: 'Gentle',
    sample: '“Uy, food’s a bit over plan — ₱1,500. Gusto mo i-rebalance natin?”',
  },
  {
    key: 'balanced',
    name: 'Balanced',
    sample:
      '“Food budget exceeded by ₱1,500 na. The meal plan was apparently suggestion lang pala.”',
    recommended: true,
  },
  {
    key: 'savage',
    name: 'Savage',
    sample:
      '“₱1,500 over on food, bes. The budget didn’t fail you — hindi mo lang siya kinonsulta.”',
  },
]

/**
 * The personality picker — the last onboarding step (1h), and the same
 * component again under Settings so the choice stays changeable "anytime",
 * as the screen promises.
 */
export function PersonalityPicker() {
  const [data, dispatch] = useStore()

  return (
    <div className="stack" style={{ gap: 10 }}>
      {PERSONALITIES.map((p) => {
        const on = data.profile.personality === p.key
        return (
          <button
            key={p.key}
            type="button"
            className="choice"
            aria-pressed={on}
            onClick={() => dispatch({ type: 'profile/personality', personality: p.key })}
          >
            <span className="choice__head">
              <RadioDot on={on} />
              <span className="choice__name">{p.name}</span>
              {p.recommended && <span className="choice__badge">recommended</span>}
            </span>
            <span className="choice__sample">{p.sample}</span>
          </button>
        )
      })}
    </div>
  )
}

/* ── small form pieces ────────────────────────────────────────────────────── */

/** One labelled control. A `<label>` may wrap exactly one — see FieldGroup. */
function Field({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <label className="field">
      <span className="field__label">{label}</span>
      {children}
      {hint && <span className="field__hint">{hint}</span>}
    </label>
  )
}

/**
 * A labelled set of controls — a segmented control, say. Wrapping several
 * buttons in a `<label>` would splice the label's text into every button's
 * accessible name ("How often are you paid? Once a month"), so this uses a
 * group instead and names it once.
 */
function FieldGroup({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <div className="field" role="group" aria-label={label}>
      <span className="field__label">{label}</span>
      {children}
      {hint && <span className="field__hint">{hint}</span>}
    </div>
  )
}

/**
 * Money input. Keeps the raw string while you type — formatting mid-keystroke
 * fights the caret — and only converts on the way out.
 */
function AmountInput({
  value,
  onChange,
  placeholder = '0',
}: {
  value: Centavos
  onChange: (next: Centavos) => void
  placeholder?: string
}) {
  const [text, setText] = useState(() => (value ? String(value / 100) : ''))

  return (
    <span className="field__money">
      <span className="field__peso">₱</span>
      <input
        className="input input--money"
        inputMode="decimal"
        placeholder={placeholder}
        value={text}
        onChange={(e) => {
          const next = e.target.value.replace(/[^\d.,]/g, '')
          setText(next)
          onChange(parseAmount(next))
        }}
      />
    </span>
  )
}

const ACCOUNT_TYPES: { key: AccountType; label: string }[] = [
  { key: 'cash', label: 'Cash' },
  { key: 'bank', label: 'Bank' },
  { key: 'ewallet', label: 'E-wallet' },
  { key: 'savings', label: 'Savings' },
]

/* ── the wizard ───────────────────────────────────────────────────────────── */

type Step = 1 | 2 | 3 | 4

const TOTAL_STEPS = 4

export function Onboarding({ onFinish }: { onFinish: () => void }) {
  const [data, dispatch] = useStore()
  const [step, setStep] = useState<Step>(1)

  const [name, setName] = useState('')
  const [payCadence, setPayCadence] = useState<SetupAnswers['payCadence']>('semi-monthly')
  const [salary, setSalary] = useState<Centavos>(0)
  const [accounts, setAccounts] = useState<AccountAnswer[]>(DEFAULT_ACCOUNTS)
  const [bills, setBills] = useState<BillAnswer[]>(COMMON_BILLS)

  const answers: SetupAnswers = { name, payCadence, salary, accounts, bills }

  /** Writes the ledger, then hands over to the personality step. */
  function commit() {
    dispatch({ type: 'data/setup', answers })
    setStep(4)
  }

  function finish() {
    dispatch({ type: 'profile/onboarded' })
    onFinish()
  }

  /** The escape hatch: look around as Dafhnee instead of entering anything. */
  function useDemo() {
    dispatch({ type: 'data/reset' })
    dispatch({ type: 'profile/onboarded' })
    onFinish()
  }

  return (
    <div className="stack onboard" style={{ gap: 20 }}>
      <div
        className="steps"
        role="progressbar"
        aria-valuenow={step}
        aria-valuemin={1}
        aria-valuemax={TOTAL_STEPS}
      >
        {Array.from({ length: TOTAL_STEPS }, (_, i) => (
          <span key={i} className={`steps__seg${i < step ? ' steps__seg--on' : ''}`} />
        ))}
      </div>

      {step === 1 && (
        <StepPayday
          name={name}
          setName={setName}
          payCadence={payCadence}
          setPayCadence={setPayCadence}
          salary={salary}
          setSalary={setSalary}
          onNext={() => setStep(2)}
          onDemo={useDemo}
        />
      )}

      {step === 2 && (
        <StepAccounts
          accounts={accounts}
          setAccounts={setAccounts}
          onBack={() => setStep(1)}
          onNext={() => setStep(3)}
        />
      )}

      {step === 3 && (
        <StepBills
          bills={bills}
          setBills={setBills}
          onBack={() => setStep(2)}
          onNext={commit}
        />
      )}

      {step === 4 && (
        <StepPersonality
          reactionsOn={data.profile.reactionsOn}
          onToggleReactions={() =>
            dispatch({ type: 'profile/reactions', on: !data.profile.reactionsOn })
          }
          onFinish={finish}
        />
      )}
    </div>
  )
}

/* ── step 1 — you and your payday ─────────────────────────────────────────── */

function StepPayday({
  name,
  setName,
  payCadence,
  setPayCadence,
  salary,
  setSalary,
  onNext,
  onDemo,
}: {
  name: string
  setName: (v: string) => void
  payCadence: SetupAnswers['payCadence']
  setPayCadence: (v: SetupAnswers['payCadence']) => void
  salary: Centavos
  setSalary: (v: Centavos) => void
  onNext: () => void
  onDemo: () => void
}) {
  const monthly = payCadence === 'semi-monthly' ? salary * 2 : salary

  return (
    <>
      <div>
        <Kicker tone="accent">Step 1 of {TOTAL_STEPS} — the basics</Kicker>
        <div className="h-page onboard__title">When does the money arrive?</div>
        <div className="onboard__sub">
          Everything else hangs off this. Safe-to-spend is really just “what’s left before the
          next payday”, so Piso needs to know when that is.
        </div>
      </div>

      <Field label="What should I call you?">
        <input
          className="input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Your name"
          autoFocus
        />
      </Field>

      <FieldGroup label="How often are you paid?">
        <div className="seg">
          {(['semi-monthly', 'monthly'] as const).map((c) => (
            <button
              key={c}
              type="button"
              className="seg__btn"
              aria-pressed={payCadence === c}
              onClick={() => setPayCadence(c)}
            >
              {c === 'semi-monthly' ? '15th & end of month' : 'Once a month'}
            </button>
          ))}
        </div>
      </FieldGroup>

      <Field
        label="Take-home per payout"
        hint={
          salary > 0
            ? `${formatMoney(monthly)} a month — after tax and deductions, what actually lands`
            : 'After tax and deductions — what actually lands in your account'
        }
      >
        <AmountInput value={salary} onChange={setSalary} placeholder="25,000" />
      </Field>

      <div className="stack push-top" style={{ gap: 8 }}>
        <button
          type="button"
          className="btn-outline btn-outline--sm"
          disabled={salary <= 0}
          onClick={onNext}
        >
          {salary > 0 ? 'Next — where your money sits' : 'Enter your take-home to continue'}
        </button>
        <button type="button" className="skip" onClick={onDemo}>
          Just show me the demo instead
        </button>
      </div>
    </>
  )
}

/* ── step 2 — accounts ────────────────────────────────────────────────────── */

function StepAccounts({
  accounts,
  setAccounts,
  onBack,
  onNext,
}: {
  accounts: AccountAnswer[]
  setAccounts: (v: AccountAnswer[]) => void
  onBack: () => void
  onNext: () => void
}) {
  const patch = (index: number, changes: Partial<AccountAnswer>) =>
    setAccounts(accounts.map((a, i) => (i === index ? { ...a, ...changes } : a)))

  const total = accounts
    .filter((a) => a.type !== 'savings')
    .reduce((sum, a) => sum + a.balance, 0)

  // Everything you log has to land in an account. Leave them all unnamed and
  // the ledger would have nowhere to put money.
  const named = accounts.filter((a) => a.name.trim()).length

  return (
    <>
      <div>
        <Kicker tone="accent">Step 2 of {TOTAL_STEPS} — where it sits</Kicker>
        <div className="h-page onboard__title">How much do you have right now?</div>
        <div className="onboard__sub">
          Rough is fine — you can correct it anytime. Savings is kept out of safe-to-spend, so
          money you don’t want to touch belongs there.
        </div>
      </div>

      <div className="stack" style={{ gap: 10 }}>
        {accounts.map((account, i) => (
          <div key={i} className="entry-row">
            <div className="entry-row__top">
              <input
                className="input input--flush"
                value={account.name}
                onChange={(e) => patch(i, { name: e.target.value })}
                placeholder="Account name"
              />
              {accounts.length > 1 && (
                <button
                  type="button"
                  className="entry-row__drop"
                  aria-label={`Remove ${account.name || 'account'}`}
                  onClick={() => setAccounts(accounts.filter((_, j) => j !== i))}
                >
                  ×
                </button>
              )}
            </div>
            <div className="entry-row__bottom">
              <div className="seg seg--sm">
                {ACCOUNT_TYPES.map((t) => (
                  <button
                    key={t.key}
                    type="button"
                    className="seg__btn"
                    aria-pressed={account.type === t.key}
                    onClick={() => patch(i, { type: t.key })}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
              <AmountInput value={account.balance} onChange={(balance) => patch(i, { balance })} />
            </div>
          </div>
        ))}

        <button
          type="button"
          className="add-row"
          onClick={() => setAccounts([...accounts, { name: '', type: 'bank', balance: 0 }])}
        >
          + Add another account
        </button>
      </div>

      <div className="onboard__tally">
        <span>Spendable now</span>
        <span className="h-num">{formatMoney(total)}</span>
      </div>

      <div className="stack push-top" style={{ gap: 8 }}>
        <button
          type="button"
          className="btn-outline btn-outline--sm"
          disabled={named === 0}
          onClick={onNext}
        >
          {named === 0 ? 'Name at least one account to continue' : 'Next — what’s already spoken for'}
        </button>
        <button type="button" className="skip" onClick={onBack}>
          Back
        </button>
      </div>
    </>
  )
}

/* ── step 3 — bills ───────────────────────────────────────────────────────── */

function StepBills({
  bills,
  setBills,
  onBack,
  onNext,
}: {
  bills: BillAnswer[]
  setBills: (v: BillAnswer[]) => void
  onBack: () => void
  onNext: () => void
}) {
  const patch = (index: number, changes: Partial<BillAnswer>) =>
    setBills(bills.map((b, i) => (i === index ? { ...b, ...changes } : b)))

  const kept = bills.filter((b) => b.name.trim() && b.amountDue > 0)
  const total = kept.reduce((sum, b) => sum + b.amountDue, 0)

  return (
    <>
      <div>
        <Kicker tone="accent">Step 3 of {TOTAL_STEPS} — the fixed stuff</Kicker>
        <div className="h-page onboard__title">What has to be paid every month?</div>
        <div className="onboard__sub">
          These get subtracted before Piso tells you what’s safe to spend. Leave a bill at ₱0 and
          it’s skipped — you can add the rest later.
        </div>
      </div>

      <div className="stack" style={{ gap: 10 }}>
        {bills.map((bill, i) => (
          <div key={i} className="entry-row">
            <div className="entry-row__top">
              <span className="entry-row__emoji">{bill.emoji}</span>
              <input
                className="input input--flush"
                value={bill.name}
                onChange={(e) => patch(i, { name: e.target.value })}
                placeholder="Bill name"
              />
              <button
                type="button"
                className="entry-row__drop"
                aria-label={`Remove ${bill.name || 'bill'}`}
                onClick={() => setBills(bills.filter((_, j) => j !== i))}
              >
                ×
              </button>
            </div>
            <div className="entry-row__bottom">
              <label className="due-day">
                <span>due</span>
                <input
                  className="input input--day"
                  inputMode="numeric"
                  value={bill.dueDay}
                  onChange={(e) => {
                    const n = Number(e.target.value.replace(/\D/g, ''))
                    patch(i, { dueDay: Math.min(31, Math.max(1, n || 1)) })
                  }}
                />
                <span className="muted">
                  {ordinalDay(bill.dueDay)} · next {formatShort(nextDueDate(bill.dueDay))}
                </span>
              </label>
              <AmountInput
                value={bill.amountDue}
                onChange={(amountDue) => patch(i, { amountDue })}
              />
            </div>
          </div>
        ))}

        <button
          type="button"
          className="add-row"
          onClick={() =>
            setBills([...bills, { name: '', emoji: '🧾', amountDue: 0, dueDay: 15 }])
          }
        >
          + Add another bill
        </button>
      </div>

      <div className="onboard__tally">
        <span>
          {kept.length} {kept.length === 1 ? 'bill' : 'bills'} a month
        </span>
        <span className="h-num">{formatMoney(total)}</span>
      </div>

      <div className="stack push-top" style={{ gap: 8 }}>
        <button type="button" className="btn-outline btn-outline--sm" onClick={onNext}>
          {kept.length > 0 ? 'Next — the fun one' : 'No bills yet — skip this'}
        </button>
        <button type="button" className="skip" onClick={onBack}>
          Back
        </button>
      </div>
    </>
  )
}

/* ── step 4 — personality (1h, as designed) ───────────────────────────────── */

function StepPersonality({
  reactionsOn,
  onToggleReactions,
  onFinish,
}: {
  reactionsOn: boolean
  onToggleReactions: () => void
  onFinish: () => void
}) {
  return (
    <>
      <div>
        <Kicker tone="accent">
          Step {TOTAL_STEPS} of {TOTAL_STEPS} — the fun one
        </Kicker>
        <div className="h-page onboard__title">How honest should I be about your spending?</div>
        <div className="onboard__sub">
          You can change this anytime. Health, family and emergency expenses are never joked about
          — that's a hard rule, not a setting.
        </div>
      </div>

      <PersonalityPicker />

      <button
        type="button"
        className="toggle-row"
        onClick={onToggleReactions}
        aria-pressed={reactionsOn}
      >
        <span className="stack">
          <span className="toggle-row__label">Reactions {reactionsOn ? 'on' : 'off'}</span>
          <span className="toggle-row__sub">full opt-out lives in Settings</span>
        </span>
        <Switch on={reactionsOn} label="Reactions" />
      </button>

      <div className="stack push-top" style={{ gap: 8 }}>
        <button type="button" className="btn-outline btn-outline--sm" onClick={onFinish}>
          Finish — show me my money
        </button>
      </div>
    </>
  )
}
