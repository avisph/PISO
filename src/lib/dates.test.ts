import { describe, expect, it } from 'vitest'
import {
  addDays,
  currentPayday,
  currentPaydayOn,
  daysBetween,
  nextPayday,
  nextPaydayOn,
  ordinalDay,
  parseISO,
  toISO,
} from './dates'

const d = (iso: string) => new Date(`${iso}T00:00:00`)
const iso = (x: Date) => toISO(x)

/**
 * Every date in this app is either a payday or measured from one, so these are
 * the boundaries worth pinning: month ends of different lengths, February, and
 * the turn of the year. A payday that lands on the wrong day moves safe-to-spend
 * and the daily allowance with it.
 */
describe('payday, whichever payroll you are on', () => {
  const cadences = ['semi-monthly', 'monthly'] as const

  it.each([
    '2026-01-01',
    '2026-01-14',
    '2026-01-15',
    '2026-01-16',
    '2026-01-31',
    '2026-02-14',
    '2026-02-28',
    '2026-06-30',
    '2026-07-15',
    '2026-07-31',
    '2026-12-31',
    '2028-02-29', // leap year
  ])('brackets %s on both cadences', (day) => {
    for (const cadence of cadences) {
      const from = d(day)
      const current = currentPaydayOn(cadence, from)
      const next = nextPaydayOn(cadence, from)

      // The cycle you are in started on or before today and ends later.
      expect(current.getTime()).toBeLessThanOrEqual(from.getTime())
      expect(next.getTime()).toBeGreaterThan(from.getTime())
      // And it is a real span, never zero days.
      expect(daysBetween(current, next)).toBeGreaterThan(0)
    }
  })

  it('monthly pays on the last day of the month', () => {
    expect(iso(nextPaydayOn('monthly', d('2026-07-15')))).toBe('2026-07-31')
    expect(iso(nextPaydayOn('monthly', d('2026-06-15')))).toBe('2026-06-30')
    expect(iso(nextPaydayOn('monthly', d('2026-02-10')))).toBe('2026-02-28')
  })

  it('monthly, standing on payday, looks to next month — not to today', () => {
    // The bug: the fallback branch recomputed the same date, so the daily
    // allowance divided the whole cycle by one day.
    expect(iso(nextPaydayOn('monthly', d('2026-07-31')))).toBe('2026-08-31')
    expect(iso(currentPaydayOn('monthly', d('2026-07-31')))).toBe('2026-07-31')
  })

  it('monthly crosses into a shorter month correctly', () => {
    expect(iso(nextPaydayOn('monthly', d('2026-01-31')))).toBe('2026-02-28')
    expect(iso(nextPaydayOn('monthly', d('2028-01-31')))).toBe('2028-02-29')
  })

  it('monthly crosses the year boundary', () => {
    expect(iso(nextPaydayOn('monthly', d('2026-12-31')))).toBe('2027-01-31')
    expect(iso(currentPaydayOn('monthly', d('2027-01-05')))).toBe('2026-12-31')
  })

  it('semi-monthly pays on the 15th and the month end', () => {
    expect(iso(nextPaydayOn('semi-monthly', d('2026-07-01')))).toBe('2026-07-15')
    expect(iso(nextPaydayOn('semi-monthly', d('2026-07-15')))).toBe('2026-07-31')
    expect(iso(nextPaydayOn('semi-monthly', d('2026-07-31')))).toBe('2026-08-15')
  })

  it('semi-monthly cycles are roughly a fortnight, never a month', () => {
    for (const day of ['2026-01-16', '2026-03-01', '2026-07-20', '2026-11-30']) {
      const from = d(day)
      const span = daysBetween(
        currentPaydayOn('semi-monthly', from),
        nextPaydayOn('semi-monthly', from),
      )
      expect(span).toBeGreaterThanOrEqual(13)
      expect(span).toBeLessThanOrEqual(17)
    }
  })

  it('the cadence-free helpers still mean semi-monthly', () => {
    for (const day of ['2026-02-10', '2026-07-31', '2026-12-31']) {
      expect(iso(nextPaydayOn('semi-monthly', d(day)))).toBe(iso(nextPayday(d(day))))
      expect(iso(currentPaydayOn('semi-monthly', d(day)))).toBe(iso(currentPayday(d(day))))
    }
  })
})

describe('ISO round-trip', () => {
  it('survives being parsed and reprinted', () => {
    for (const day of ['2026-01-01', '2026-02-28', '2026-12-31', '2028-02-29']) {
      expect(toISO(parseISO(day))).toBe(day)
    }
  })

  it('does not drift across a daylight-saving-shaped boundary', () => {
    // The Philippines has no DST, but the app must not depend on that: parsing
    // must stay local-midnight either way.
    const start = parseISO('2026-03-28')
    expect(toISO(addDays(start, 1))).toBe('2026-03-29')
    expect(toISO(addDays(start, 2))).toBe('2026-03-30')
  })
})

describe('daysBetween', () => {
  it('counts whole days forward', () => {
    expect(daysBetween(d('2026-07-01'), d('2026-07-08'))).toBe(7)
  })

  it('is zero for the same day', () => {
    expect(daysBetween(d('2026-07-01'), d('2026-07-01'))).toBe(0)
  })

  it('goes negative backwards, so callers must clamp', () => {
    expect(daysBetween(d('2026-07-08'), d('2026-07-01'))).toBe(-7)
  })
})

describe('ordinalDay', () => {
  it('uses the English suffixes, including the teens', () => {
    expect(ordinalDay(1)).toBe('1st')
    expect(ordinalDay(2)).toBe('2nd')
    expect(ordinalDay(3)).toBe('3rd')
    expect(ordinalDay(4)).toBe('4th')
    expect(ordinalDay(11)).toBe('11th')
    expect(ordinalDay(12)).toBe('12th')
    expect(ordinalDay(13)).toBe('13th')
    expect(ordinalDay(21)).toBe('21st')
    expect(ordinalDay(31)).toBe('31st')
  })
})
