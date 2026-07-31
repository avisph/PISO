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
          balanced: `${late.name}. ${days} ${days === 1 ? 'day' : 'days'} late. not to be dramatic but the wifi you're reading this on has feelings.`,
          savage: `${late.name}, ${days} ${days === 1 ? 'day' : 'days'} overdue, ${formatMoney(billOutstanding(late))}. bold of you.`,
        },
        data.profile.personality,
      )
    }
    return pick(
      {
        gentle: 'walang overdue. clean record this cycle, quietly proud of you.',
        balanced: 'nothing overdue. enjoy it, may bill pa naman next week.',
        savage: 'zero overdue bills. sino ka and what did you do to my friend.',
      },
      data.profile.personality,
    )
  }

  if (context === 'debt') {
    return pick(
      {
        gentle: 'steady ang bayad mo. tuloy lang, ayos ka.',
        balanced: 'not you making responsible decisions. character development is real.',
        savage: "paying above the minimum? unprompted? ok ate girl, i see you.",
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
        balanced: `${over} over on ${name}. so the plan was a suggestion. good to know.`,
        savage: `${formatMoney(worst.variance)} over on ${name}. the budget didn't fail you, you just never consulted it.`,
      },
      data.profile.personality,
    )
  }

  return pick(
    {
      gentle: 'nasa plano ka pa. keep going ha.',
      balanced: 'every envelope still behaving. suspicious. but we love it.',
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
