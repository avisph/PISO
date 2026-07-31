import { describe, expect, it } from 'vitest'
import { clampZero, formatMoney, parseAmount, peso, sum, toPesos } from './money'

describe('peso', () => {
  it('converts to integer centavos', () => {
    expect(peso(1)).toBe(100)
    expect(peso(25_000)).toBe(2_500_000)
    expect(peso(0.1)).toBe(10)
  })

  it('rounds rather than truncating, so halves do not vanish', () => {
    expect(peso(0.005)).toBe(1)
    expect(peso(12.345)).toBe(1235)
  })

  it('never produces a fractional centavo', () => {
    for (const n of [0.1, 0.2, 1.15, 19.99, 1234.567]) {
      expect(Number.isInteger(peso(n))).toBe(true)
    }
  })

  it('survives the float that breaks naive money code', () => {
    // 0.1 + 0.2 !== 0.3 in binary floating point. In centavos it is just 30.
    expect(peso(0.1) + peso(0.2)).toBe(peso(0.3))
  })
})

describe('parseAmount', () => {
  it('reads a plain keypad string', () => {
    expect(parseAmount('180')).toBe(18_000)
    expect(parseAmount('180.5')).toBe(18_050)
    expect(parseAmount('180.55')).toBe(18_055)
  })

  it('reads thousands separators, which a typed salary always has', () => {
    // Number("25,000") is NaN. Getting this wrong made a ₱25,000 salary ₱0,
    // silently, at the exact moment the app asked for it.
    expect(parseAmount('25,000')).toBe(2_500_000)
    expect(parseAmount('1,234.56')).toBe(123_456)
  })

  it('ignores currency marks and spaces', () => {
    expect(parseAmount('₱1 200')).toBe(120_000)
    expect(parseAmount('PHP 350')).toBe(35_000)
  })

  it('treats empty and junk as zero rather than NaN', () => {
    expect(parseAmount('')).toBe(0)
    expect(parseAmount('abc')).toBe(0)
    expect(parseAmount('.')).toBe(0)
  })

  it('truncates past two decimal places instead of rounding up into a peso', () => {
    expect(parseAmount('10.999')).toBe(1099)
  })

  it('round-trips through toPesos', () => {
    for (const text of ['0', '1', '350', '25,000', '1,234.56']) {
      expect(peso(toPesos(parseAmount(text)))).toBe(parseAmount(text))
    }
  })
})

describe('formatMoney', () => {
  it('renders whole pesos without decimals', () => {
    expect(formatMoney(peso(5_321))).toBe('₱5,321')
  })

  it('keeps the sign on the outside of the symbol', () => {
    expect(formatMoney(peso(-1_200))).toBe('−₱1,200')
  })

  it('can be asked for an explicit plus', () => {
    expect(formatMoney(peso(500), { signed: true })).toBe('+₱500')
  })

  it('can drop the symbol', () => {
    expect(formatMoney(peso(340), { symbol: false })).toBe('340')
  })
})

describe('sum and clampZero', () => {
  it('sums an empty list to zero rather than NaN', () => {
    expect(sum([])).toBe(0)
  })

  it('clamps negatives to zero and leaves positives alone', () => {
    expect(clampZero(-1)).toBe(0)
    expect(clampZero(0)).toBe(0)
    expect(clampZero(42)).toBe(42)
  })
})
