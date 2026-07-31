import { useStore } from '../state/store'
import { Bar, BackLink, Kicker } from '../components/ui'
import { formatMoney, peso } from '../lib/money'
import { planAllocation } from '../lib/finance'
import { daysBetween, formatShort, parseISO } from '../lib/dates'

const STEP = peso(100)

/**
 * 1c — Allocation planner. Envelopes plus the live status bar: the plan is the
 * budget, and the footer never lets you leave it silently over-allocated.
 */
export function Planner({ onBack }: { onBack: () => void }) {
  const [data, dispatch] = useStore()
  const { plan } = data
  const { allocated, unallocated, status } = planAllocation(plan)

  const start = parseISO(plan.startsOn)
  const end = parseISO(plan.endsOn)
  const coverDays = daysBetween(start, end) + 1

  const statusColor =
    status === 'exact' ? 'var(--p-positive)' : status === 'over' ? 'var(--p-danger)' : 'var(--p-warn-text)'

  const statusLabel =
    status === 'exact'
      ? '₱0 left to assign — exact plan ✓'
      : status === 'over'
        ? `${formatMoney(-unallocated)} over-allocated`
        : `${formatMoney(unallocated)} left to assign`

  const adjust = (itemId: string, planned: number) =>
    dispatch({ type: 'plan/setPlanned', itemId, planned })

  return (
    <div className="stack" style={{ minHeight: '100%' }}>
      <div className="stack" style={{ gap: 10, padding: '22px 20px 14px' }}>
        <div className="row-center">
          <BackLink onClick={onBack}>Plan this salary</BackLink>
          <div style={{ display: 'flex', gap: 6 }}>
            <button type="button" className="btn-chip">
              Use template ▾
            </button>
            <button
              type="button"
              className="btn-chip btn-chip--accent"
              onClick={() => {
                // The suggested plan: fund every locked obligation, keep 10%
                // for the emergency fund, leave the rest where it is.
                const emergency = plan.items.find((i) => i.id === 'emergency')
                if (emergency) adjust(emergency.id, Math.round(plan.total * 0.1))
              }}
            >
              Suggest for me
            </button>
          </div>
        </div>

        <div>
          <Kicker tone="accent">{plan.label}</Kicker>
          <div className="h-page" style={{ fontSize: 34 }}>
            {formatMoney(plan.total)}
          </div>
          <div className="muted" style={{ fontSize: 11.5 }}>
            covers {formatShort(start)} – {formatShort(end)} · {coverDays} days
          </div>
        </div>
      </div>

      <div className="stack" style={{ flex: 1, gap: 8, padding: '4px 20px 16px' }}>
        {plan.items.map((item) => {
          // Three row shapes, exactly as the mockup draws them:
          //  · an obligation that funds a bill/debt — amount only, no stepper
          //  · the assistant's suggestion — accent-outlined, amount only
          //  · a spendable envelope — stepper, and a bar once money has moved
          const fundsObligation = Boolean(item.locked && item.debtId)
          const fixed = fundsObligation || item.suggested
          const linkedBill = item.billId
            ? data.bills.find((b) => b.id === item.billId)
            : undefined

          return (
            <div key={item.id} className={`env-row${item.suggested ? ' env-row--suggested' : ''}`}>
              <span
                className="icon-tile icon-tile--lg"
                style={item.suggested ? { background: 'var(--p-accent-softer)' } : undefined}
              >
                {item.emoji}
              </span>

              <div className="env-row__body">
                {fixed ? (
                  <>
                    <div style={{ fontSize: 13 }}>{item.name}</div>
                    {item.note && (
                      <div
                        style={{
                          fontSize: 10,
                          color: item.suggested ? 'var(--p-accent-text2)' : 'var(--p-faint)',
                        }}
                      >
                        {linkedBill
                          ? `due ${formatShort(parseISO(linkedBill.dueOn))} · ${item.note}`
                          : item.note}
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    <div className="env-row__title">
                      <span>{item.name}</span>
                      {item.note && <span className="env-row__note">{item.note}</span>}
                    </div>
                    {item.locked ? (
                      // Committed money: a striped track, nothing to "spend".
                      <div className="bar bar--xs" style={{ position: 'relative' }}>
                        <span className="env-row__striped" />
                      </div>
                    ) : (
                      item.spent > 0 && (
                        <Bar
                          value={item.spent}
                          max={item.planned}
                          size="xs"
                          variant="dim"
                          label={`${item.name} spent`}
                        />
                      )
                    )}
                  </>
                )}
              </div>

              {fixed ? (
                <span className="env-row__amt">{formatMoney(item.planned)}</span>
              ) : (
                <div className="env-row__stepper">
                  <button
                    type="button"
                    className="step"
                    aria-label={`Decrease ${item.name}`}
                    disabled={item.planned <= 0}
                    onClick={() => adjust(item.id, item.planned - STEP)}
                  >
                    −
                  </button>
                  <span className="env-row__amt">{formatMoney(item.planned)}</span>
                  <button
                    type="button"
                    className="step"
                    aria-label={`Increase ${item.name}`}
                    onClick={() => adjust(item.id, item.planned + STEP)}
                  >
                    +
                  </button>
                </div>
              )}
            </div>
          )
        })}

        <button
          type="button"
          className="add-envelope"
          onClick={() =>
            dispatch({ type: 'plan/addItem', name: 'New envelope', emoji: '📁', planned: 0 })
          }
        >
          + add envelope
        </button>
      </div>

      <div className="planner-foot">
        <div className="row-center">
          <span className="planner-status" style={{ color: statusColor }}>
            <span className="planner-status__dot" />
            {statusLabel}
          </span>
          <span className="muted" style={{ fontSize: 11 }}>
            {formatMoney(allocated)} / {formatMoney(plan.total)}
          </span>
        </div>
        <Bar
          value={Math.min(allocated, plan.total)}
          max={plan.total}
          variant={status === 'over' ? 'warn' : 'positive'}
          label="Allocated"
        />
        <button type="button" className="btn-outline btn-outline--sm" onClick={onBack}>
          {status === 'over' ? 'Fix the over-allocation' : 'Activate plan'}
        </button>
      </div>
    </div>
  )
}
