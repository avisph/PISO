import { useState } from 'react'
import { useStore } from '../state/store'
import { Kicker } from '../components/ui'
import { formatMoney } from '../lib/money'
import { billOutstanding, openBills, upcoming } from '../lib/finance'
import { daysBetween, formatShort, parseISO, relativeDue, today } from '../lib/dates'
import { BesReaction } from '../components/BesReaction'

const HORIZONS = [7, 15, 30] as const

/**
 * 1g — Bills. 7/15/30-day horizon, overdue always first and always red.
 */
export function Bills() {
  const [data, dispatch] = useStore()
  const [horizon, setHorizon] = useState<(typeof HORIZONS)[number]>(7)

  const now = today()
  const window = upcoming(data, horizon, now)
  const inHorizon = new Set(window.bills.map((b) => b.id))
  const later = openBills(data)
    .filter((b) => !inHorizon.has(b.id))
    .sort((a, b) => a.dueOn.localeCompare(b.dueOn))

  const pay = (billId: string, amount: number) =>
    dispatch({ type: 'bill/pay', billId, amount, accountId: 'payroll' })

  return (
    <div className="screen screen--pad-bottom" style={{ gap: 14 }}>
      <div className="row-center">
        <h1 className="h-screen" style={{ margin: 0 }}>
          Bills
        </h1>
        <div className="seg seg--sm" role="group" aria-label="Horizon">
          {HORIZONS.map((h) => (
            <button
              key={h}
              type="button"
              className="seg__opt"
              aria-pressed={horizon === h}
              onClick={() => setHorizon(h)}
            >
              {h}d
            </button>
          ))}
        </div>
      </div>

      <div className="surface-pad row-between">
        <span className="muted" style={{ fontSize: 12 }}>
          Next {horizon} days · {window.count} {window.count === 1 ? 'bill' : 'bills'}
        </span>
        <span className="h-num" style={{ fontSize: 20 }}>
          {formatMoney(window.total)}
        </span>
      </div>

      <section className="stack" style={{ gap: 8 }}>
        {window.bills.length === 0 && (
          <div className="surface-pad muted" style={{ fontSize: 12.5 }}>
            Nothing due in this window.
          </div>
        )}

        {window.bills.map((bill) => {
          const dueDate = parseISO(bill.dueOn)
          const daysOut = daysBetween(now, dueDate)
          const overdue = daysOut < 0
          const outstanding = billOutstanding(bill)

          return (
            <div key={bill.id} className={`bill-row${overdue ? ' bill-row--overdue' : ''}`}>
              <div className="bill-row__body">
                <span className="bill-row__name">{bill.name}</span>
                <span
                  className={`bill-row__meta ${overdue ? 'danger' : daysOut <= 3 ? 'warn' : 'muted'}`}
                >
                  {overdue
                    ? `${relativeDue(dueDate, now)} · ${formatMoney(outstanding)} of ${formatMoney(bill.amountDue)} still unpaid`
                    : `due ${formatShort(dueDate)} · ${relativeDue(dueDate, now)}${bill.hint ? ` · ${bill.hint}` : ''}`}
                </span>
              </div>
              <span className="bill-row__amt">{formatMoney(outstanding)}</span>
              <button type="button" className="btn-mini" onClick={() => pay(bill.id, outstanding)}>
                Pay
              </button>
            </div>
          )
        })}
      </section>

      {later.length > 0 && (
        <>
          <Kicker tone="faint">Later this cycle</Kicker>
          <section className="stack">
            {later.map((bill, index) => (
              <div
                key={bill.id}
                className={`later-row${index < later.length - 1 ? ' rule-fade' : ''}`}
              >
                <span>{bill.name}</span>
                <span className="muted">
                  {formatShort(parseISO(bill.dueOn))} · {formatMoney(billOutstanding(bill))}
                </span>
              </div>
            ))}
          </section>
        </>
      )}

      <BesReaction context="bills" className="quote push-top" />
    </div>
  )
}
