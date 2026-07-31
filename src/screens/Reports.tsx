import { useStore } from '../state/store'
import { Kicker, Ring } from '../components/ui'
import { formatMoney, formatPct, peso } from '../lib/money'
import { healthScore, worstVariances } from '../lib/finance'

/**
 * 1i — Month review. Cash-flow bars, the two worst variances, the health score
 * as a compass rather than a grade, and one applicable suggestion.
 */
export function Reports() {
  const [data, dispatch] = useStore()

  const flow = data.monthlyFlow
  const current = flow[flow.length - 1]
  const net = current.moneyIn - current.moneyOut
  const scale = Math.max(...flow.flatMap((m) => [m.moneyIn, m.moneyOut]))

  const worst = worstVariances(data.plan, 2)
  const health = healthScore(data)

  const foodItem = data.plan.items.find((i) => i.id === 'food')
  const suggestion = worst[0]
  const suggestedAmount = suggestion
    ? Math.ceil((suggestion.item.spent + peso(300)) / peso(500)) * peso(500)
    : 0

  return (
    <div className="screen screen--pad-bottom" style={{ gap: 16 }}>
      <section>
        <Kicker tone="accent">{current.label}'s story</Kicker>
        <div className="h-page">
          You ended {formatMoney(Math.abs(net))} {net >= 0 ? 'ahead' : 'behind'}
        </div>
        <div className="muted" style={{ fontSize: 12 }}>
          money in {formatMoney(current.moneyIn)} · money out {formatMoney(current.moneyOut)}
        </div>
      </section>

      <section className="flow-chart">
        {flow.map((month, index) => {
          const isCurrent = index === flow.length - 1
          return (
            <div key={month.label} className="flow-col">
              <div className="flow-col__bars">
                <span
                  className={`flow-col__bar${isCurrent ? ' flow-col__bar--current-in' : ''}`}
                  style={{ height: `${(month.moneyIn / scale) * 100}%` }}
                  title={`${month.label} in: ${formatMoney(month.moneyIn)}`}
                />
                <span
                  className={`flow-col__bar flow-col__bar--out${isCurrent ? ' flow-col__bar--current-out' : ''}`}
                  style={{ height: `${(month.moneyOut / scale) * 100}%` }}
                  title={`${month.label} out: ${formatMoney(month.moneyOut)}`}
                />
              </div>
              <span className={`flow-col__label${isCurrent ? ' flow-col__label--current' : ''}`}>
                {month.label}
              </span>
            </div>
          )
        })}
        <div className="flow-legend">
          <span>
            <i style={{ background: 'var(--p-accent-bar)' }} />
            in
          </span>
          <span>
            <i style={{ background: 'var(--p-dim)' }} />
            out
          </span>
        </div>
      </section>

      {worst.length > 0 && (
        <section className="stack" style={{ gap: 8 }}>
          <Kicker>Plan vs actual — worst {worst.length}</Kicker>
          {worst.map((v) => (
            <div key={v.item.id} className="variance-row">
              <span>{v.item.name}</span>
              <span className="warn">
                +{formatPct(v.variancePct)} · {formatMoney(v.variance)} over
              </span>
            </div>
          ))}
        </section>
      )}

      <section className="health">
        <Ring
          size={86}
          stroke={7}
          percent={health.score / 100}
          value={String(health.score)}
          valueSize={20}
        />
        <div className="health__factors">
          <div className="health__factor">
            <span className="muted">Bills on time</span>
            <span>
              {health.billsOnTime.points}/{health.billsOnTime.max}
            </span>
          </div>
          <div className="bar bar--hair">
            <div
              className="bar__fill bar__fill--accent"
              style={{ width: `${(health.billsOnTime.points / health.billsOnTime.max) * 100}%` }}
            />
          </div>
          <div className="health__factor">
            <span className="muted">Debt pressure</span>
            <span>
              {health.debtPressure.points}/{health.debtPressure.max}
            </span>
          </div>
          <div className="bar bar--hair">
            <div
              className="bar__fill bar__fill--accent"
              style={{ width: `${(health.debtPressure.points / health.debtPressure.max) * 100}%` }}
            />
          </div>
          <div className="health__factor">
            <span className="muted">Saving habit</span>
            <span>
              {health.savingHabit.points}/{health.savingHabit.max}
            </span>
          </div>
          <div className="bar bar--hair">
            <div
              className="bar__fill bar__fill--accent"
              style={{ width: `${(health.savingHabit.points / health.savingHabit.max) * 100}%` }}
            />
          </div>
          <div className="health__note">a compass, not a grade — every factor is the math above</div>
        </div>
      </section>

      {suggestion && foodItem && (
        <section className="suggestion">
          <div className="suggestion__text">
            {suggestion.item.name} ran over — raise the envelope to{' '}
            <b>{formatMoney(suggestedAmount)}</b> next cycle?
          </div>
          <button
            type="button"
            className="btn-mini"
            onClick={() =>
              dispatch({
                type: 'plan/setPlanned',
                itemId: suggestion.item.id,
                planned: suggestedAmount,
              })
            }
          >
            Apply
          </button>
        </section>
      )}
    </div>
  )
}
