import { useData } from '../state/store'
import { Bar, Kicker } from '../components/ui'
import { formatMoney } from '../lib/money'
import {
  availableCash,
  billOutstanding,
  dailyAllowance,
  safeToSpend,
  savingsBalance,
  totalDebt,
  upcoming,
} from '../lib/finance'
import { daysBetween, formatShort, formatWithWeekday, parseISO, today } from '../lib/dates'
import { BesReaction } from '../components/BesReaction'
import type { Route } from '../nav/routes'

/**
 * 1j — the desktop translation. Same mental model, three columns: the hero
 * keeps its place, due-soon and the envelopes sit side by side.
 */
export function DesktopDashboard({ onNavigate }: { onNavigate: (route: Route) => void }) {
  const data = useData()
  const now = today()
  const sts = safeToSpend(data, now)
  const { perDay, payday } = dailyAllowance(data, now)
  const week = upcoming(data, 15, now)
  const envelopes = data.plan.items.filter((i) => i.categoryId)

  return (
    <div className="desktop-main">
      <div className="desktop-hero">
        <div>
          <Kicker tone="accent">Safe to spend</Kicker>
          <div className="desktop-hero__amount">
            {formatMoney(sts.amount)}{' '}
            <span>
              {formatMoney(perDay)}/day until {formatShort(payday)}
            </span>
          </div>
        </div>
        <div className="desktop-hero__who">
          Hi {data.profile.name} · {formatWithWeekday(now)}
        </div>
      </div>

      <div className="desktop-stats">
        <div className="desktop-stat">
          <div className="desktop-stat__label">Cash &amp; bank</div>
          <div className="desktop-stat__value">{formatMoney(availableCash(data))}</div>
        </div>
        <button
          type="button"
          className="desktop-stat"
          onClick={() => onNavigate({ name: 'debts' })}
        >
          <div className="desktop-stat__label">You owe</div>
          <div className="desktop-stat__value">{formatMoney(totalDebt(data))}</div>
        </button>
        <div className="desktop-stat">
          <div className="desktop-stat__label">Savings</div>
          <div className="desktop-stat__value">{formatMoney(savingsBalance(data))}</div>
        </div>
      </div>

      <div className="desktop-cols">
        <section className="desktop-panel">
          <Kicker>Due soon</Kicker>
          {week.bills.slice(0, 3).map((bill) => {
            const daysOut = daysBetween(now, parseISO(bill.dueOn))
            return (
              <div key={bill.id} className="desktop-panel__row">
                <span>
                  {bill.emoji} {bill.name}
                </span>
                <span>
                  {formatMoney(billOutstanding(bill))} ·{' '}
                  <span className={daysOut <= 3 ? 'warn' : undefined}>
                    {daysOut < 0 ? `${Math.abs(daysOut)} days late` : `${daysOut} days`}
                  </span>
                </span>
              </div>
            )
          })}
          <button
            type="button"
            className="faint"
            style={{ fontSize: 11, textAlign: 'left' }}
            onClick={() => onNavigate({ name: 'bills' })}
          >
            next 15 days: {formatMoney(week.total)} total →
          </button>
        </section>

        <section className="desktop-panel">
          <Kicker>This cycle's plan</Kicker>
          {envelopes.map((item) => {
            const over = item.spent > item.planned
            return (
              <div key={item.id} className="stack" style={{ gap: 2 }}>
                <div className="envelope__head">
                  <span>{item.name}</span>
                  <span className={over ? 'warn' : 'muted'}>
                    {over
                      ? `over ${formatMoney(item.spent - item.planned)}`
                      : `${formatMoney(item.spent, { compact: true, symbol: false })}/${formatMoney(item.planned, { compact: true, symbol: false })}`}
                  </span>
                </div>
                <Bar
                  value={item.spent}
                  max={item.planned}
                  size="sm"
                  variant={over ? 'warn' : 'plan'}
                  label={item.name}
                />
              </div>
            )
          })}
        </section>
      </div>

      <BesReaction context="dashboard" className="desktop-quote" />
    </div>
  )
}
