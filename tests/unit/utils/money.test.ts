import { describe, expect, it } from 'vitest'
import { currencySymbol, formatMoney, priceInput } from '@/utils/money'

describe('formatMoney', () => {
  it('puts the symbol before the amount, with cents', () => {
    expect(formatMoney(123450, 'USD')).toBe('$1,234.50')
    expect(formatMoney(5, 'EUR')).toBe('€0.05')
  })

  it('drops the cents only when asked and there are none', () => {
    expect(formatMoney(120000, 'GBP', { whole: true })).toBe('£1,200')
    expect(formatMoney(120050, 'GBP', { whole: true })).toBe('£1,200.50')
  })

  it('writes the code after the amount for a currency without a symbol', () => {
    expect(formatMoney(1000, 'CHF')).toBe('10.00 CHF')
  })
})

describe('priceInput', () => {
  it('gives an editable amount, without cents when there are none', () => {
    expect(priceInput(120000)).toBe('1200')
    expect(priceInput(9950)).toBe('99.50')
    expect(priceInput(null)).toBe('')
  })
})

describe('currencySymbol', () => {
  it('trims the symbol and falls back to the code', () => {
    expect(currencySymbol('PLN')).toBe('zł')
    expect(currencySymbol('CHF')).toBe('CHF')
  })
})
