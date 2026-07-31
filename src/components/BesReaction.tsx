import { useData } from '../state/store'
import { formatMoney, formatPct } from '../lib/money'
import { billOutstanding, overdueBills, worstVariances } from '../lib/finance'
import { daysBetween, parseISO, today } from '../lib/dates'
import type { Personality } from '../types'

/**
 * The reaction line — Bes's one-liner under a screen.
 *
 * Three rules, straight from the blueprint (§20) and the design chat:
 *  1. Reactions are opt-out; when off, nothing renders.
 *  2. Health, family and emergency spending is never joked about — a hard
 *     rule, not a setting.
 *  3. Copy is Gen Z deadpan Taglish, and the sass level follows the
 *     personality — same voice throughout, only the sharpness moves.
 */

const NEVER_JOKE_CATEGORIES = new Set(['health', 'family'])

type Context = 'dashboard' | 'bills' | 'debt' | 'chat'

interface Line {
  gentle: string
  balanced: string
  savage: string
}

function pick(line: Line, personality: Personality): string {
  return line[personality]
}

export function reactionFor(
  context: Context,
  data: ReturnType<typeof useData>,
): string | null {
  const now = today()

  if (context === 'bills') {
    const late = overdueBills(data, now)[0]
    if (late) {
      const days = Math.abs(daysBetween(now, parseISO(late.dueOn)))
      return pick(
        {
          gentle: `${late.name} is ${days} ${days === 1 ? 'day' : 'days'} late. no judgment. gusto mo bayaran na natin?`,
          balanced: `si ${late.name}, ${days} ${days === 1 ? 'day' : 'days'} late na. wag lang ma-dramatic pero may damdamin din ang wifi na ginagamit mo ngayon.`,
          savage: `${late.name}, ${days} ${days === 1 ? 'day' : 'days'} overdue, ${formatMoney(billOutstanding(late))}. ang tapang mo ha.`,
        },
        data.profile.personality,
      )
    }
    return pick(
      {
        gentle: 'walang overdue. ang linis ng record mo this cycle, proud ako tahimik lang.',
        balanced: 'walang overdue. i-enjoy mo, may bill pa naman next week.',
        savage: 'zero overdue bills. sino ka at anong ginawa mo sa kaibigan ko.',
      },
      data.profile.personality,
    )
  }

  if (context === 'debt') {
    return pick(
      {
        gentle: 'steady ang bayad mo. tuloy lang, ayos ka.',
        balanced: 'ikaw ba talaga tong gumagawa ng responsableng desisyon. character development, totoo pala.',
        savage: 'lampas sa minimum? kusa? sige ate girl, nakikita kita.',
      },
      data.profile.personality,
    )
  }

  // Dashboard: lead with the worst envelope variance, if there is one.
  const worst = worstVariances(data.plan, 1)[0]
  if (worst && !NEVER_JOKE_CATEGORIES.has(worst.item.categoryId ?? '')) {
    const over = formatPct(worst.variancePct)
    const name = worst.item.name.toLowerCase()
    return pick(
      {
        gentle: `${name} is a bit over — ${formatMoney(worst.variance)}. gusto mo i-rebalance natin?`,
        balanced: `${over} over ka sa ${name}. so suggestion lang pala yung plan. noted.`,
        savage: `${formatMoney(worst.variance)} over sa ${name}. hindi ka binigo ng budget, hindi mo lang siya kinausap.`,
      },
      data.profile.personality,
    )
  }

  return pick(
    {
      gentle: 'nasa plano ka pa. keep going ha.',
      balanced: 'lahat ng envelope, mabait pa. kahina-hinala. pero sige, we love it.',
      savage: 'on plan ka. screenshot this, baka hindi na maulit.',
    },
    data.profile.personality,
  )
}

export function BesReaction({
  context,
  className = 'quote',
  style,
}: {
  context: Context
  className?: string
  style?: React.CSSProperties
}) {
  const data = useData()
  if (!data.profile.reactionsOn) return null

  const line = reactionFor(context, data)
  if (!line) return null

  return (
    <p className={className} style={style}>
      “{line}”
    </p>
  )
}
