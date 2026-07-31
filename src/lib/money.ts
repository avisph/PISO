/**
 * Money is integer centavos everywhere. JSON numbers are floats and are banned
 * for money (blueprint §6, §8) — nothing in the app adds pesos as decimals.
 */

export type Centavos = number

export const peso = (pesos: number): Centavos => Math.round(pesos * 100)

export const toPesos = (c: Centavos): number => c / 100

export const sum = (values: Centavos[]): Centavos =>
  values.reduce((total, v) => total + v, 0)

export const clampZero = (c: Centavos): Centavos => (c < 0 ? 0 : c)

/** Percentage of a centavo amount, rounded to the nearest centavo. */
export const pct = (c: Centavos, fraction: number): Centavos =>
  Math.round(c * fraction)

const groupedFormatter = new Intl.NumberFormat('en-PH', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
})

const decimalFormatter = new Intl.NumberFormat('en-PH', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

export interface FormatOptions {
  /** Show ₱ (default true). */
  symbol?: boolean
  /** Always show .00 — used on the quick-add confirm card. */
  decimals?: boolean
  /** Render 4200 as "4.2k" — the desktop envelope rows do this. */
  compact?: boolean
  /** Always render a leading + or −. */
  signed?: boolean
}

/** The single money renderer — ₱ formatting, grouping, sign, compaction. */
export function formatMoney(c: Centavos, opts: FormatOptions = {}): string {
  const { symbol = true, decimals = false, compact = false, signed = false } = opts
  const negative = c < 0
  const abs = Math.abs(c)

  let body: string
  if (compact && abs >= 100_000) {
    const k = abs / 100_000
    body = `${k % 1 === 0 ? k.toFixed(0) : k.toFixed(1)}k`
  } else if (decimals) {
    body = decimalFormatter.format(abs / 100)
  } else {
    body = groupedFormatter.format(Math.round(abs / 100))
  }

  const sign = negative ? '−' : signed ? '+' : ''
  return `${sign}${symbol ? '₱' : ''}${body}`
}

/** "18%" from a 0–1 fraction. */
export const formatPct = (fraction: number, digits = 0): string =>
  `${(fraction * 100).toFixed(digits)}%`

/**
 * Parse a typed amount ("180", "180.5", "25,000", "₱1 200") into centavos.
 *
 * Thousands separators matter here: the keypad never produces one, but a
 * person typing their salary into a text field will, and `Number("25,000")`
 * is NaN — which would silently become a ₱0 salary.
 */
export function parseAmount(input: string): Centavos {
  if (!input) return 0
  const cleaned = input.replace(/[^\d.]/g, '')
  if (!cleaned) return 0
  const [whole, fraction = ''] = cleaned.split('.')
  const centavos = Number((fraction + '00').slice(0, 2))
  return Number(whole || 0) * 100 + (Number.isFinite(centavos) ? centavos : 0)
}
