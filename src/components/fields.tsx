import { useState, type ReactNode } from 'react'
import { parseAmount, type Centavos } from '../lib/money'

/** One labelled control. A `<label>` may wrap exactly one — see FieldGroup. */
export function Field({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: ReactNode
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
export function FieldGroup({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: ReactNode
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
 * Money input. Keeps the raw string while you type — reformatting mid-keystroke
 * fights the caret — and only converts on the way out.
 */
export function AmountInput({
  value,
  onChange,
  placeholder = '0',
  wide = false,
}: {
  value: Centavos
  onChange: (next: Centavos) => void
  placeholder?: string
  wide?: boolean
}) {
  const [text, setText] = useState(() => (value ? String(value / 100) : ''))

  return (
    <span className="field__money" style={wide ? { width: '100%' } : undefined}>
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

/** A segmented control over a fixed set of options. */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  small = false,
}: {
  options: { key: T; label: string }[]
  value: T
  onChange: (next: T) => void
  small?: boolean
}) {
  return (
    <div className={`seg${small ? ' seg--sm' : ''}`}>
      {options.map((o) => (
        <button
          key={o.key}
          type="button"
          className="seg__btn"
          aria-pressed={value === o.key}
          onClick={() => onChange(o.key)}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

/** Day-of-month input, clamped to a real day. */
export function DayInput({
  value,
  onChange,
}: {
  value: number
  onChange: (next: number) => void
}) {
  return (
    <input
      className="input input--day"
      inputMode="numeric"
      value={value}
      onChange={(e) => {
        const n = Number(e.target.value.replace(/\D/g, ''))
        onChange(Math.min(31, Math.max(1, n || 1)))
      }}
    />
  )
}
