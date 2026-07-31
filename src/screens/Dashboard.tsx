import { useState } from 'react'
import { useData } from '../state/store'
import { Bar, BellIcon, CardIcon, Kicker } from '../components/ui'
import { formatMoney, formatPct, sum } from '../lib/money'
import {
  availableCash,
  billOutstanding,
  dailyAllowance,
  cycleProgress,
  safeToSpend,
  savingsBalance,
  totalDebt,
  upcoming,
} from '../lib/finance'
import { daysBetween, formatShort, parseISO, relativeDue, today } from '../lib/dates'
import type { Route } from '../nav/routes'
import { BesReaction } from '../components/BesReaction'

/**
 * 1a — Home. Hero safe-to-spend, the due strip, this cycle's envelopes, and
 * one Bes reaction at the bottom.
 */
export function Dashboard({ onNavigate }: { onNavigate: (route: Route) => void }) {
  const data = useData()
  const [showMath, setShowMath] = useState(false)

  const now = today()
  const stsResult = safeToSpend(data, now)
  const { perDay, days, payday } = dailyAllowance(data, now)
  const cash = availableCash(data)
  const savings = savingsBalance(data)
  const owed = totalDebt(data)

  const due = upcoming(data, 7, now)
  const fortnight = upcoming(data, 15, now)
  const nextTwo = due.bills.slice(0, 2)

  // Money that actually left the debts in the last 30 days — the "▾ x% this
  // month" trend, computed rather than asserted.
  const paidDown = sum(
    data.transactions
      .filter((t) => t.kind === 'debt_payment' && daysBetween(parseISO(t.date), now) <= 30)
      .map((t) => t.amount),
  )
  const trend = owed + paidDown === 0 ? 0 : paidDown / (owed + paidDown)

  const envelopes = data.plan.items.filter((i) => i.categoryId)
  const cycle = cycleProgress(data.plan, now)

  return (
    <div className="screen">
      <header className="row-center">
        <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 500, fontSize: 17 }}>
          Hi {data.profile.name}
        </div>
        <button
          type="button"
          className="bell"
          aria-label="Notifications"
          onClick={() => onNavigate({ name: 'bills' })}
        >
          <BellIcon />
          <span className="bell__dot" />
        </button>
      </header>

      <section>
        <Kicker tone="accent">Safe to spend</Kicker>
        <div className="hero-line">
          <div className="h-hero">{formatMoney(stsResult.amount)}</div>
          <button
            type="button"
            className="link-dotted"
            aria-expanded={showMath}
            onClick={() => setShowMath((v) => !v)}
          >
            {showMath ? 'hide the math' : 'see the math'}
          </button>
        </div>
        <div className="hero-sub">
          {formatMoney(perDay)}/day until {formatShort(payday)} · payday in {days}{' '}
          {days === 1 ? 'day' : 'days'}
        </div>

        {showMath && (
          <div className="surface-pad stack" style={{ gap: 6, marginTop: 10 }}>
            {stsResult.breakdown.map((line) => (
              <div
                key={line.label}
                style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}
              >
                <span className="muted">{line.label}</span>
                <span>{formatMoney(line.amount, { signed: line.amount > 0 })}</span>
              </div>
            ))}
            <div
              className="rule-fade"
              style={{ height: 1, margin: '4px 0' }}
              aria-hidden="true"
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5 }}>
              <span>Safe to spend</span>
              <b>{formatMoney(stsResult.amount)}</b>
            </div>
            {stsResult.shortfall > 0 && (
              <div className="danger" style={{ fontSize: 11, lineHeight: 1.5 }}>
                You're {formatMoney(stsResult.shortfall)} short of covering everything before
                payday — Bills shows what's due first.
              </div>
            )}
          </div>
        )}
      </section>

      <section className="grid-2">
        <div className="stat">
          <div className="stat-label">Cash &amp; bank</div>
          <div className="h-num">{formatMoney(cash)}</div>
          <div className="stat-sub">+ {formatMoney(savings)} in savings</div>
        </div>
        <button type="button" className="stat" onClick={() => onNavigate({ name: 'debts' })}>
          <div className="stat-label">You owe</div>
          <div className="h-num">{formatMoney(owed)}</div>
          <div
            className="positive"
            style={{ fontSize: 10.5, display: 'flex', alignItems: 'center', gap: 3 }}
          >
            ▾ {formatPct(trend)} this month
          </div>
        </button>
      </section>

      <section className="stack" style={{ gap: 8 }}>
        <div className="row-between">
          <Kicker>Due soon</Kicker>
          <button type="button" className="link-quiet" onClick={() => onNavigate({ name: 'bills' })}>
            see all
          </button>
        </div>

        {nextTwo.length === 0 && (
          <div className="surface-pad muted" style={{ fontSize: 12.5 }}>
            Nothing due in the next 7 days. Rare. Enjoy it.
          </div>
        )}

        {nextTwo.map((bill) => {
          const dueDate = parseISO(bill.dueOn)
          const daysOut = daysBetween(now, dueDate)
          const urgent = daysOut <= 3
          return (
            <button
              key={bill.id}
              type="button"
              className="line-row"
              onClick={() => onNavigate({ name: 'bills' })}
            >
              <span
                className="icon-tile"
                style={{ color: bill.id === 'meralco' ? 'oklch(0.78 0.13 80)' : 'var(--p-accent-text2)' }}
              >
                {bill.id === 'bpi-min' ? <CardIcon /> : (bill.emoji ?? '•')}
              </span>
              <span className="line-row__name">{bill.name}</span>
              <span className="line-row__amt">{formatMoney(billOutstanding(bill))}</span>
              <span className={`chip${urgent ? ' chip--warn' : ''}`}>{relativeDue(dueDate, now)}</span>
            </button>
          )
        })}

        <div className="due-more">
          ▸ next 15 days: {fortnight.count} {fortnight.count === 1 ? 'bill' : 'bills'},{' '}
          {formatMoney(fortnight.total)} total
        </div>
      </section>

      <section className="stack" style={{ gap: 10 }}>
        <div className="row-between">
          <Kicker>This cycle's plan</Kicker>
          <button
            type="button"
            className="muted"
            style={{ fontSize: 11 }}
            onClick={() => onNavigate({ name: 'planner' })}
          >
            {Math.round(cycle * 100)}% through
          </button>
        </div>

        {envelopes.map((item) => {
          const over = item.spent > item.planned
          return (
            <div key={item.id} className="envelope">
              <div className="envelope__head">
                <span>{item.name}</span>
                <span className={over ? 'warn' : 'muted'}>
                  {over
                    ? `over by ${formatMoney(item.spent - item.planned)}`
                    : `${formatMoney(item.spent)} / ${formatMoney(item.planned)}`}
                </span>
              </div>
              <Bar
                value={item.spent}
                max={item.planned}
                variant={over ? 'warn' : 'plan'}
                label={`${item.name} envelope`}
              />
            </div>
          )
        })}
      </section>

      <BesReaction context="dashboard" />
    </div>
  )
}
