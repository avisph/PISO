/**
 * Date helpers. Everything is local-midnight based — a bill is "due in 3 days"
 * regardless of the time of day you open the app.
 */

export type ISODate = string // "2026-08-03"

export const startOfDay = (d: Date): Date =>
  new Date(d.getFullYear(), d.getMonth(), d.getDate())

export const today = (): Date => startOfDay(new Date())

export const parseISO = (iso: ISODate): Date => {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, (m ?? 1) - 1, d ?? 1)
}

export const toISO = (d: Date): ISODate => {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export const addDays = (d: Date, days: number): Date => {
  const next = new Date(d)
  next.setDate(next.getDate() + days)
  return startOfDay(next)
}

export const addMonths = (d: Date, months: number): Date => {
  const next = new Date(d)
  next.setMonth(next.getMonth() + months)
  return startOfDay(next)
}

const DAY_MS = 86_400_000

/** Whole days from a → b. Negative when b is in the past. */
export const daysBetween = (a: Date, b: Date): number =>
  Math.round((startOfDay(b).getTime() - startOfDay(a).getTime()) / DAY_MS)

/**
 * Semi-monthly payroll: the 15th and the last day of the month (payday "30th"
 * in the persona's words). Returns the next one strictly after `from`.
 */
export function nextPayday(from: Date = today()): Date {
  const day = from.getDate()
  const endOfMonth = new Date(from.getFullYear(), from.getMonth() + 1, 0).getDate()
  if (day < 15) return new Date(from.getFullYear(), from.getMonth(), 15)
  if (day < endOfMonth) return new Date(from.getFullYear(), from.getMonth(), endOfMonth)
  return new Date(from.getFullYear(), from.getMonth() + 1, 15)
}

/** The most recent payday on or before `from` — the day the cycle began. */
export function currentPayday(from: Date = today()): Date {
  const day = from.getDate()
  const endOfMonth = new Date(from.getFullYear(), from.getMonth() + 1, 0).getDate()
  if (day >= endOfMonth) return new Date(from.getFullYear(), from.getMonth(), endOfMonth)
  if (day >= 15) return new Date(from.getFullYear(), from.getMonth(), 15)
  return new Date(from.getFullYear(), from.getMonth(), 0)
}

/** "Aug 15" */
export const formatShort = (d: Date): string =>
  d.toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })

/** "Thu, Jul 31" */
export const formatWithWeekday = (d: Date): string =>
  d.toLocaleDateString('en-PH', { weekday: 'short', month: 'short', day: 'numeric' })

/** "March 2028" */
export const formatMonthYear = (d: Date): string =>
  d.toLocaleDateString('en-PH', { month: 'long', year: 'numeric' })

/** "Jan 2027" */
export const formatMonthYearShort = (d: Date): string =>
  d.toLocaleDateString('en-PH', { month: 'short', year: 'numeric' })

/** "7:42 PM" */
export const formatTime = (d: Date): string =>
  d.toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit' })

/** The relative phrasing the bill rows use: "in 3 days" / "overdue 2 days". */
export function relativeDue(due: Date, from: Date = today()): string {
  const days = daysBetween(from, due)
  if (days < 0) return `overdue ${Math.abs(days)} ${Math.abs(days) === 1 ? 'day' : 'days'}`
  if (days === 0) return 'due today'
  if (days === 1) return 'tomorrow'
  return `in ${days} days`
}

/** Ordinal day-of-month, for "due 5th" / "due 30th". */
export function ordinalDay(day: number): string {
  const rem10 = day % 10
  const rem100 = day % 100
  if (rem10 === 1 && rem100 !== 11) return `${day}st`
  if (rem10 === 2 && rem100 !== 12) return `${day}nd`
  if (rem10 === 3 && rem100 !== 13) return `${day}rd`
  return `${day}th`
}
