import type { ChatEvent, ChatRequest, Draft } from '../shared/chat'

/**
 * The fallback response library, used only when the server has no Anthropic
 * credentials. It keeps the screen demonstrable — including the parse-draft
 * card — without pretending to be the real thing: the UI shows an "offline"
 * notice whenever this is what answered.
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

function parseDraft(text: string): Draft | null {
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
    accountId: 'gcash',
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
          ? `Ayan, pumasok ang pera. Nilagay ko na sa draft — confirm mo lang, bes.`
          : `Noted. Draft ko muna, ikaw bahala kung i-confirm.${
              left !== null && envelope
                ? ` ${envelope.name} envelope: ₱${left.toLocaleString('en-PH')} na lang for the rest of the cycle.`
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
          ? `Depende sa magkano, bes. Safe-to-spend mo is ₱${pesos(context.safeToSpend)} until ${context.payday.date}.`
          : value <= safe
            ? `Uy technically yes naman — ₱${pesos(amount!)} fits pa sa ₱${pesos(context.safeToSpend)} safe-to-spend mo. Pero bes${
                bill ? `, si ${bill.name} darating in ${bill.dueIn} days` : ''
              }, so "afford" is doing a lot of work dito ha.`
            : `Hindi muna, bes. ₱${pesos(amount!)} vs ₱${pesos(context.safeToSpend)} safe-to-spend — hindi siya kasya without borrowing from something else.`,
    })
    return events
  }

  if (/\b(due|bayarin|bills?|utang na bayad)\b/i.test(text)) {
    const bills = context.upcomingBills.slice(0, 3)
    events.push({
      type: 'text',
      text: bills.length
        ? `Ito ang paparating: ${bills
            .map((b) => `${b.name} ₱${pesos(b.amount)} in ${b.dueIn} day(s)`)
            .join(', ')}. Wala nang surprises, promise.`
        : 'Wala munang due sa malapit. Rare ito, enjoy mo.',
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
        ? `Sa ${worst.name} ka pinaka-gumastos: ₱${pesos(worst.spent)} out of ₱${pesos(worst.planned)} planned. Hindi naman ito accusation ha, observation lang.`
        : 'Wala pang gastos this cycle. Suspicious, pero sige.',
    })
    return events
  }

  events.push({
    type: 'text',
    text: `Safe to spend mo ngayon: ₱${pesos(context.safeToSpend)}, or ₱${pesos(context.dailyAllowance)}/day until ${context.payday.date}. Ask mo lang kung ano ang gusto mong malaman, bes.`,
  })
  return events
}
