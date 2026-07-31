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
 *  3. Copy is conyo Taglish, and the sass level follows the personality.
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
          gentle: `Uy bes, si ${late.name} is ${days} ${days === 1 ? 'day' : 'days'} late na. Gusto mo bayaran na natin?`,
          balanced: `Bes, si ${late.name} is ${days} ${days === 1 ? 'day' : 'days'} late na. The internet you're reading this on may feelings din.`,
          savage: `${late.name}, ${days} ${days === 1 ? 'day' : 'days'} overdue. Ang tapang mo ha — ${formatMoney(billOutstanding(late))} lang naman 'yan.`,
        },
        data.profile.personality,
      )
    }
    return pick(
      {
        gentle: 'Walang overdue — ang linis ng record mo this cycle, bes.',
        balanced: "Nothing overdue. Kalma muna tayo — may Meralco pa naman next week.",
        savage: 'No overdue bills. Sino ka at anong ginawa mo sa kaibigan ko?',
      },
      data.profile.personality,
    )
  }

  if (context === 'debt') {
    return pick(
      {
        gentle: 'Ang galing mo, bes — steady lang ang bayad. Tuloy-tuloy lang tayo.',
        balanced: 'Look at you naman, making responsible decisions. Character development talaga, bes.',
        savage: "Paying more than the minimum? Sino'ng nagturo sa'yo? Proud ako, kahit papaano.",
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
        gentle: `Uy, ${name} is a bit over plan — ${formatMoney(worst.variance)}. Gusto mo i-rebalance natin?`,
        balanced: `Bes, you spent ${over} more on ${name} kaysa sa plan. The meal plan was more of a suggestion lang pala.`,
        savage: `${formatMoney(worst.variance)} over on ${name}, bes. The budget didn't fail you — hindi mo lang siya kinonsulta.`,
      },
      data.profile.personality,
    )
  }

  return pick(
    {
      gentle: 'Nasa plano ka pa naman, bes. Keep going ha.',
      balanced: 'Every envelope is still behaving. Suspicious, pero we love to see it.',
      savage: 'On plan ka. Screenshot mo ‘to, baka hindi na maulit.',
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
