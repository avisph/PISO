import { useData } from '../state/store'
import { Kicker } from '../components/ui'
import { formatMoney, formatPct } from '../lib/money'
import {
  activeDebts,
  cardUtilization,
  debtFreeDate,
  debtProgress,
  monthlyDebtLoad,
  simulateStrategy,
  totalDebt,
} from '../lib/finance'
import { formatMonthYear, ordinalDay, parseISO, today } from '../lib/dates'
import { peso } from '../lib/money'
import type { Route } from '../nav/routes'
import { useState } from 'react'

/**
 * 1d — Debts. Trophy-shelf framing: the debt-free date is the headline, the
 * paid-off shelf sits at the bottom, and no row scolds.
 */
export function Debts({ onNavigate }: { onNavigate: (route: Route) => void }) {
  const data = useData()
  const [showStrategies, setShowStrategies] = useState(false)

  const now = today()
  const owed = totalDebt(data)
  const active = activeDebts(data)
  const cleared = data.debts.filter((d) => d.clearedOn)

  const pace = Math.max(monthlyDebtLoad(data), peso(4_500))
  const projection = debtFreeDate(data, pace, now)

  const extra = Math.max(0, pace - monthlyDebtLoad(data))
  const snowball = simulateStrategy(active, extra, 'snowball', now)
  const avalanche = simulateStrategy(active, extra, 'avalanche', now)

  return (
    <div className="screen screen--pad-bottom" style={{ gap: 14 }}>
      <section>
        <Kicker>You owe</Kicker>
        <div className="h-hero h-hero--sm">{formatMoney(owed)}</div>
        <div style={{ fontSize: 12.5, color: 'var(--p-accent-text2)', marginTop: 2 }}>
          Debt-free: <span style={{ fontWeight: 600 }}>{projection.label}</span> at current pace ·{' '}
          <span className="muted">assuming {formatMoney(projection.pace)}/mo</span>
        </div>
      </section>

      <section className="stack" style={{ gap: 10 }}>
        {active.map((debt) => {
          const progress = debtProgress(debt)
          const utilization = cardUtilization(debt)

          if (debt.kind === 'informal') {
            return (
              <button
                key={debt.id}
                type="button"
                className="debt-card"
                style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}
                onClick={() => onNavigate({ name: 'debt', id: debt.id })}
              >
                <span className="avatar">{debt.name.replace(/^Utang kay /, '').charAt(0)}</span>
                <span className="stack" style={{ flex: 1, gap: 1, alignItems: 'flex-start' }}>
                  <span style={{ fontSize: 14 }}>{debt.name}</span>
                  <span style={{ fontSize: 10.5 }} className="muted">
                    {debt.note}
                  </span>
                </span>
                <span className="h-num h-num--md">{formatMoney(debt.balance)}</span>
              </button>
            )
          }

          if (debt.kind === 'installment') {
            const paid = debt.termsPaid ?? 0
            const total = debt.termsTotal ?? 1
            return (
              <button
                key={debt.id}
                type="button"
                className="debt-card"
                onClick={() => onNavigate({ name: 'debt', id: debt.id })}
              >
                <span className="debt-card__head">
                  <span className="debt-card__name">{debt.name}</span>
                  <span className="h-num h-num--md">{formatMoney(debt.balance)}</span>
                </span>
                <span className="pip-row" role="img" aria-label={`${paid} of ${total} paid`}>
                  {Array.from({ length: total }, (_, i) => (
                    <span key={i} className={`pip${i < paid ? ' pip--on' : ''}`} />
                  ))}
                </span>
                <span className="debt-card__meta">
                  <span>
                    {paid} of {total} paid
                  </span>
                  <span>
                    {formatMoney(debt.minPayment)}/mo
                    {debt.dueDay ? ` · due ${ordinalDay(debt.dueDay)}` : ''} · {debt.note}
                  </span>
                </span>
              </button>
            )
          }

          return (
            <button
              key={debt.id}
              type="button"
              className="debt-card"
              onClick={() => onNavigate({ name: 'debt', id: debt.id })}
            >
              <span className="debt-card__head">
                <span className="debt-card__name">{debt.name}</span>
                <span className="h-num h-num--md">{formatMoney(debt.balance)}</span>
              </span>
              <span className="bar bar--sm">
                <span
                  className="bar__fill bar__fill--accent"
                  style={{ width: `${Math.max(0, Math.min(1, progress)) * 100}%`, display: 'block' }}
                />
              </span>
              <span className="debt-card__meta">
                <span>
                  {formatPct(progress)} paid of {formatMoney(debt.originalAmount)}
                </span>
                <span>
                  {debt.cadence === 'semi-monthly'
                    ? `${formatMoney(debt.minPayment)} semi-monthly`
                    : `min ${formatMoney(debt.minPayment)}${debt.dueDay ? ` · due ${ordinalDay(debt.dueDay)}` : ''}`}
                  {debt.monthlyRate > 0 ? ` · ${(debt.monthlyRate * 100).toFixed(debt.monthlyRate < 0.01 ? 2 : 0)}%/mo` : ''}
                  {utilization !== null && debt.kind !== 'card' ? '' : ''}
                </span>
              </span>
            </button>
          )
        })}
      </section>

      {cleared.length > 0 && (
        <section className="stack" style={{ gap: 8, marginTop: 2 }}>
          <Kicker tone="faint">Paid off 🏁</Kicker>
          {cleared.map((debt) => (
            <div key={debt.id} className="paid-off">
              <span className="paid-off__name">{debt.name}</span>
              <span className="positive" style={{ fontSize: 10.5 }}>
                {formatMoney(debt.originalAmount)} · cleared{' '}
                {formatMonthYear(parseISO(debt.clearedOn!))}
              </span>
            </div>
          ))}
        </section>
      )}

      {showStrategies && (
        <section className="surface-pad stack" style={{ gap: 8, fontSize: 12.5, lineHeight: 1.5 }}>
          <div className="row-between">
            <span>Avalanche — highest interest first</span>
            <span className="muted">
              {avalanche.debtFreeDate ? formatMonthYear(avalanche.debtFreeDate) : '—'}
            </span>
          </div>
          <div className="row-between">
            <span>Snowball — smallest balance first</span>
            <span className="muted">
              {snowball.debtFreeDate ? formatMonthYear(snowball.debtFreeDate) : '—'}
            </span>
          </div>
          <p className="muted" style={{ margin: 0, fontSize: 11.5 }}>
            {avalanche.totalInterest < snowball.totalInterest
              ? `Avalanche saves you ${formatMoney(snowball.totalInterest - avalanche.totalInterest)} in interest; snowball clears your smallest debt sooner.`
              : `Both land in the same place at this pace — pick whichever keeps you going.`}{' '}
            No interest on Kuya — mathematically last, but relationships aren't math.
          </p>
        </section>
      )}

      <button
        type="button"
        className="btn-quiet push-top"
        onClick={() => setShowStrategies((v) => !v)}
      >
        {showStrategies ? 'Hide payoff strategies' : 'Compare payoff strategies →'}
      </button>
    </div>
  )
}
