import type { ChatEvent, ChatRequest, Draft } from './chat'

/**
 * The fallback response library.
 *
 * Lives in `shared/` because it has to run in two places. On the server it
 * answers when no model is configured. In the browser it answers when there is
 * no server at all — which is the normal case on a phone, where the app is
 * installed and your Ollama is at home on the wifi you are not currently on.
 *
 * Pure and dependency-free for that reason: no fetch, no node built-ins.
 * The UI always shows an "offline" notice when this is what replied.
 */

const CATEGORY_HINTS: { match: RegExp; categoryId: string; merchant?: string }[] = [
  { match: /\b(grab|angkas|taxi|jeep|jeepney|bus|lrt|mrt|gas|toll|transpo)\b/i, categoryId: 'transpo' },
  { match: /\b(jollibee|mcdo|food|kain|lunch|dinner|almusal|merienda|coffee|kape|milk ?tea)\b/i, categoryId: 'food' },
  { match: /\b(grocery|puregold|sm|supermarket|palengke)\b/i, categoryId: 'grocery' },
  { match: /\b(netflix|spotify|movie|sine|concert|game|fun|inuman)\b/i, categoryId: 'fun' },
  { match: /\b(meralco|maynilad|pldt|converge|globe|smart|kuryente|tubig|bill)\b/i, categoryId: 'utilities' },
  { match: /\b(rent|upa|renta)\b/i, categoryId: 'home' },
  { match: /\b(gamot|doctor|hospital|medicine|checkup)\b/i, categoryId: 'health' },
  { match: /\b(padala|allowance|nanay|tatay|kuya|ate|family)\b/i, categoryId: 'family' },
]

/**
 * Does this message actually report an amount?
 *
 * A draft can only ever restate money the user just told us about. When the
 * message carries no figure at all — "where did my money go?" — any amount in
 * a draft was invented by the model, usually by lifting a number out of the
 * snapshot. Confirming that would charge the user a second time for spending
 * already recorded, which is the one mistake a ledger must never make.
 *
 * Spelled-out amounts count: "dalawang libo", "2k", "five hundred".
 */
export function mentionsAmount(text: string): boolean {
  if (/\d/.test(text)) return true
  return /\b(libo|daan|raan|piso|sangkatlo|kalahati|isang|dalawang|tatlong|apat|lima|limang|sampung|beinte|singkwenta|dose|hundred|thousand|half)\b/i.test(
    text,
  )
}

const SPEND_WORDS = /\b(spent|gastos|nagastos|bumili|binili|bayad|binayaran|nag-?grab|gumastos)\b/i
const INCOME_WORDS = /\b(sahod|received|natanggap|nakatanggap|kinita|income|bonus)\b/i

function parseAmount(text: string): string | null {
  const match = text.match(/(?:₱|php\s*)?(\d[\d,]*(?:\.\d{1,2})?)\s*(k\b)?/i)
  if (!match) return null
  const base = Number(match[1].replace(/,/g, ''))
  if (!Number.isFinite(base)) return null
  const value = match[2] ? base * 1000 : base
  return value.toFixed(2)
}

/**
 * A last-resort natural-language parse. Used by the offline library, and as a
 * safety net for models whose tool calling is unreliable — the user still has
 * to confirm the draft, so a wrong guess costs one tap.
 */
export function parseDraft(text: string): Draft | null {
  const amount = parseAmount(text)
  if (!amount) return null
  if (/\b(afford|kaya ko ba|pwede ba|should i|magkano|how much)\b/i.test(text)) return null
  if (!SPEND_WORDS.test(text) && !INCOME_WORDS.test(text)) return null

  const hint = CATEGORY_HINTS.find((h) => h.match.test(text))
  const income = INCOME_WORDS.test(text)

  return {
    kind: income ? 'income' : 'expense',
    amount,
    categoryId: income ? 'salary' : (hint?.categoryId ?? 'food'),
    merchant: text.match(/\b(grab|jollibee|mcdo|netflix|meralco|pldt|shopee|lazada)\b/i)?.[0],
    // No accountId: this runs on the server and cannot see the user's
    // accounts. Naming one from the demo persona would point the draft at an
    // account that may not exist. The client picks a real one on confirm.
    date: /\bkahapon|yesterday\b/i.test(text) ? 'yesterday' : 'today',
  }
}


/** ₱1,234 — the same shape the UI uses, so the copy reads identically. */
function pesos(decimalString: string): string {
  const value = Number(decimalString)
  if (!Number.isFinite(value)) return decimalString
  return value.toLocaleString('en-PH', { maximumFractionDigits: value % 1 === 0 ? 0 : 2 })
}

export function offlineReply(request: ChatRequest): ChatEvent[] {
  const lastUser = [...request.turns].reverse().find((t) => t.role === 'user')
  const text = lastUser && lastUser.role === 'user' ? lastUser.text : ''
  const { context } = request
  const events: ChatEvent[] = []

  const draft = parseDraft(text)
  if (draft) {
    const envelope = context.envelopes.find((e) => e.id === draft.categoryId)
    const left = envelope
      ? Math.max(0, Number(envelope.planned) - Number(envelope.spent) - Number(draft.amount))
      : null
    events.push({
      type: 'text',
      text:
        draft.kind === 'income'
          ? `pumasok ang pera. drafted ko na. confirm mo lang.`
          : `drafted ko na. confirm mo kung totoo.${
              left !== null && envelope
                ? ` ${envelope.name} mo: ₱${left.toLocaleString('en-PH')} na lang hanggang payday.`
                : ''
            }`,
    })
    events.push({ type: 'draft', draft, toolUseId: `offline-${Date.now()}` })
    return events
  }

  if (/\b(afford|kaya ko ba|pwede ba)\b/i.test(text)) {
    const amount = parseAmount(text)
    const safe = Number(context.safeToSpend)
    const value = amount === null ? null : Number(amount)
    const bill = context.upcomingBills[0]
    events.push({
      type: 'text',
      text:
        value === null
          ? `depende kung magkano. ₱${pesos(context.safeToSpend)} ang safe to spend mo hanggang ${context.payday.date}.`
          : value <= safe
            ? `technically kasya. ₱${pesos(amount!)} sa ₱${pesos(context.safeToSpend)} mo.${
                bill ? ` pero si ${bill.name}, ${bill.dueIn} days na lang.` : ''
              } nag-o-overtime yung salitang "afford" dyan ha.`
            : `hindi. ₱${pesos(amount!)} vs ₱${pesos(context.safeToSpend)} safe to spend. hindi kasya, unless kunin mo sa iba.`,
    })
    return events
  }

  if (/\b(due|bayarin|bills?|utang na bayad)\b/i.test(text)) {
    const bills = context.upcomingBills.slice(0, 3)
    events.push({
      type: 'text',
      text: bills.length
        ? `paparating: ${bills
            .map((b) => `${b.name} ₱${pesos(b.amount)} in ${b.dueIn} day(s)`)
            .join(', ')}. wala nang sorpresa, promise.`
        : 'walang due sa malapit. rare ito ha, i-enjoy mo.',
    })
    return events
  }

  if (/\b(where|saan|napunta|money go|gastos ko)\b/i.test(text)) {
    const worst = [...context.envelopes].sort(
      (a, b) => Number(b.spent) - Number(a.spent),
    )[0]
    events.push({
      type: 'text',
      text: worst
        ? `sa ${worst.name} ka umabot ng ₱${pesos(worst.spent)} sa ₱${pesos(worst.planned)} planned. hindi ito akusasyon. observation lang.`
        : 'wala pang gastos this cycle. kahina-hinala. pero sige.',
    })
    return events
  }

  events.push({
    type: 'text',
    text: `₱${pesos(context.safeToSpend)} ang safe to spend mo, or ₱${pesos(context.dailyAllowance)}/day hanggang ${context.payday.date}. tanong ka lang.`,
  })
  return events
}
