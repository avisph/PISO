import { useData } from '../state/store'
import { Bar, Kicker } from '../components/ui'
import { formatMoney } from '../lib/money'
import {
  availableCash,
  cycleProgress,
  planAllocation,
  savingsBalance,
  upcoming,
} from '../lib/finance'
import { formatShort, parseISO, today } from '../lib/dates'
import type { Route } from '../nav/routes'

/**
 * The Money tab. The planner's own header reads "← Plan this salary", so it is
 * entered from here; this hub also carries the other money destinations the
 * desktop rail lists under "More".
 */
export function Money({ onNavigate }: { onNavigate: (route: Route) => void }) {
  const data = useData()
  const now = today()
  const { plan } = data
  const { allocated, unallocated, status } = planAllocation(plan)
  const cycle = cycleProgress(plan, now)
  const week = upcoming(data, 7, now)

  const rows: { label: string; meta: string; route: Route }[] = [
    {
      label: 'Bills',
      meta: `${week.count} due in 7 days · ${formatMoney(week.total)}`,
      route: { name: 'bills' },
    },
    {
      label: 'Month review',
      meta: 'cash flow, variances, health score',
      route: { name: 'reports' },
    },
    {
      label: 'Settings',
      meta: 'appearance, Bes, your cushion',
      route: { name: 'settings' },
    },
  ]

  return (
    <div className="screen screen--pad-bottom" style={{ gap: 16 }}>
      <h1 className="h-screen" style={{ margin: 0 }}>
        Money
      </h1>

      <button
        type="button"
        className="surface-pad stack"
        style={{ gap: 10 }}
        onClick={() => onNavigate({ name: 'planner' })}
      >
        <span className="row-between">
          <Kicker tone="accent">{plan.label}</Kicker>
          <span className="muted" style={{ fontSize: 11 }}>
            {Math.round(cycle * 100)}% through
          </span>
        </span>
        <span className="row-between">
          <span className="h-num">{formatMoney(plan.total)}</span>
          <span
            className={status === 'exact' ? 'positive' : status === 'over' ? 'danger' : 'warn'}
            style={{ fontSize: 11.5 }}
          >
            {status === 'exact'
              ? 'exact plan ✓'
              : status === 'over'
                ? `${formatMoney(-unallocated)} over`
                : `${formatMoney(unallocated)} to assign`}
          </span>
        </span>
        <Bar
          value={Math.min(allocated, plan.total)}
          max={plan.total}
          variant={status === 'over' ? 'warn' : 'positive'}
          label="Allocated"
        />
        <span className="muted" style={{ fontSize: 11 }}>
          {formatShort(parseISO(plan.startsOn))} – {formatShort(parseISO(plan.endsOn))} · tap to plan
          this salary
        </span>
      </button>

      <section className="grid-2">
        <div className="stat">
          <div className="stat-label">Cash &amp; bank</div>
          <div className="h-num">{formatMoney(availableCash(data))}</div>
          <div className="stat-sub">across {data.accounts.filter((a) => a.type !== 'credit' && a.type !== 'savings').length} accounts</div>
        </div>
        <div className="stat">
          <div className="stat-label">Savings</div>
          <div className="h-num">{formatMoney(savingsBalance(data))}</div>
          <div className="stat-sub">kept out of safe-to-spend</div>
        </div>
      </section>

      <section className="stack" style={{ gap: 8 }}>
        {rows.map((row) => (
          <button
            key={row.label}
            type="button"
            className="settings-row"
            onClick={() => onNavigate(row.route)}
          >
            <span className="stack" style={{ flex: 1, alignItems: 'flex-start', gap: 1 }}>
              <span style={{ fontSize: 13.5 }}>{row.label}</span>
              <span className="muted" style={{ fontSize: 10.5 }}>
                {row.meta}
              </span>
            </span>
            <span className="settings-row__chevron">›</span>
          </button>
        ))}
      </section>

      <section className="stack" style={{ gap: 8 }}>
        <Kicker tone="faint">Accounts</Kicker>
        {data.accounts.map((account) => (
          <div key={account.id} className="line-row">
            <span className="line-row__name">{account.name}</span>
            <span className="line-row__amt">{formatMoney(account.balance)}</span>
            <span className="chip">{account.type}</span>
          </div>
        ))}
      </section>
    </div>
  )
}
