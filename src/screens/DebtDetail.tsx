import { useStore } from '../state/store'
import { BackLink, Kicker, Ring } from '../components/ui'
import { formatMoney, formatPct } from '../lib/money'
import { cardUtilization, debtProgress, simulatePayoff } from '../lib/finance'
import {
  formatMonthYearShort,
  formatShort,
  ordinalDay,
  parseISO,
  toISO,
  today,
} from '../lib/dates'
import { BesReaction } from '../components/BesReaction'

/**
 * 1e — Debt detail. The ring, the projection, the payment history, and one
 * honest caveat: the statement is the source of truth, this is an estimate.
 */
export function DebtDetail({ debtId, onBack }: { debtId: string; onBack: () => void }) {
  const [data, dispatch] = useStore()
  const debt = data.debts.find((d) => d.id === debtId)

  if (!debt) {
    return (
      <div className="screen screen--pad-bottom">
        <BackLink onClick={onBack}>Debts</BackLink>
        <p className="muted">That debt is gone — paid off, or never existed.</p>
      </div>
    )
  }

  const now = today()
  const progress = debtProgress(debt)
  const utilization = cardUtilization(debt)
  const linkedBill = data.bills.find((b) => b.debtId === debt.id && b.status !== 'paid')

  // The plan's extra payment on top of the minimum — what she's actually paying.
  const extra = data.plan.items
    .filter((i) => i.debtId === debt.id && !i.billId)
    .reduce((total, i) => total + i.planned, 0)
  const monthlyPace = debt.minPayment + extra
  const payoff = simulatePayoff(debt, monthlyPace, now)

  const payMinimum = () => {
    dispatch({
      type: 'transaction/add',
      transaction: {
        kind: 'debt_payment',
        amount: debt.minPayment,
        accountId: 'payroll',
        debtId: debt.id,
        merchant: 'from BPI Payroll',
        date: toISO(now),
        source: 'keypad',
      },
    })
    if (linkedBill) {
      dispatch({
        type: 'bill/pay',
        billId: linkedBill.id,
        amount: 0,
        accountId: 'payroll',
      })
    }
  }

  return (
    <div className="screen screen--pad-bottom" style={{ gap: 16 }}>
      <div className="row-center">
        <BackLink onClick={onBack}>{debt.name}</BackLink>
        <span className="faint" style={{ fontSize: 16 }} aria-hidden="true">
          ⋯
        </span>
      </div>

      <section style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
        <Ring
          size={110}
          stroke={9}
          percent={progress}
          value={formatPct(progress)}
          sublabel="paid"
          valueSize={17}
        />
        <div>
          <Kicker>Balance</Kicker>
          <div className="h-num h-num--lg">{formatMoney(debt.balance)}</div>
          <div className="muted" style={{ fontSize: 11 }}>
            of {formatMoney(debt.originalAmount)}
            {debt.monthlyRate > 0 &&
              ` · ${(debt.monthlyRate * 100).toFixed(debt.monthlyRate < 0.01 ? 2 : 0)}%/mo`}
            {debt.creditLimit && ` · limit ${formatMoney(debt.creditLimit)}`}
          </div>
          {utilization !== null && (
            <div className="warn" style={{ fontSize: 11, marginTop: 3 }}>
              utilization {formatPct(utilization)}
            </div>
          )}
        </div>
      </section>

      {debt.minPayment > 0 && (
        <button type="button" className="btn-outline btn-outline--sm" onClick={payMinimum}>
          Pay {formatMoney(debt.minPayment)} minimum
          {linkedBill ? ` · due ${formatShort(parseISO(linkedBill.dueOn))}` : debt.dueDay ? ` · due ${ordinalDay(debt.dueDay)}` : ''}
        </button>
      )}

      <section className="surface-pad stack" style={{ gap: 4 }}>
        {payoff.never ? (
          <div style={{ fontSize: 12.5 }} className="warn">
            At {formatMoney(monthlyPace)}/month the interest eats the payment — this never clears.
            Raise the payment and the projection comes back.
          </div>
        ) : (
          <div style={{ fontSize: 12.5 }}>
            At {formatMoney(monthlyPace)}/month → done{' '}
            <span style={{ color: 'var(--p-accent-text2)', fontWeight: 600 }}>
              {payoff.debtFreeDate ? formatMonthYearShort(payoff.debtFreeDate) : '—'}
            </span>
          </div>
        )}
        <div className="muted" style={{ fontSize: 11 }}>
          {payoff.never
            ? 'estimate only'
            : `~${formatMoney(payoff.totalInterest)} interest to go`}{' '}
          — estimate; your statement is the source of truth.{' '}
          <span className="accent">Statement sync →</span>
        </div>
      </section>

      {debt.history && debt.history.length > 0 && (
        <section className="stack" style={{ gap: 2 }}>
          <Kicker>Payment history</Kicker>
          <div style={{ height: 6 }} />
          {debt.history.map((event, index) => (
            <div
              key={event.id}
              className={`history-row${index < debt.history!.length - 1 ? ' rule-fade' : ''}`}
            >
              <span>
                {formatShort(parseISO(event.date))} · {event.label}
              </span>
              <span
                className={
                  event.kind === 'payment'
                    ? 'positive'
                    : event.kind === 'charge'
                      ? 'danger'
                      : 'muted'
                }
              >
                {event.kind === 'payment'
                  ? `− ${formatMoney(event.amount)}`
                  : event.kind === 'charge'
                    ? `+ ${formatMoney(event.amount)}`
                    : `adjusted +${formatMoney(event.amount)}`}
              </span>
            </div>
          ))}
        </section>
      )}

      <BesReaction context="debt" className="quote push-top" />
    </div>
  )
}
