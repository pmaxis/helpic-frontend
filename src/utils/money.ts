/** Currencies a freelancer can bill in; the backend's money package has the same list. */
export const CURRENCIES = ['USD', 'EUR', 'GBP', 'UAH', 'PLN', 'CAD'] as const

const SYMBOLS: Record<string, string> = { USD: '$', EUR: '€', GBP: '£', UAH: '₴', PLN: 'zł ', CAD: 'CA$' }

/** "$1,234.50" from cents; with whole, "$1,234" when there are no cents to show. */
export function formatMoney(cents: number, currency: string, { whole = false } = {}): string {
  const digits = whole && cents % 100 === 0 ? 0 : 2
  const amount = (cents / 100).toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits })
  const symbol = SYMBOLS[currency]
  return symbol ? symbol + amount : `${amount} ${currency}`
}

/** Cents as an editable amount: "1200" or "99.50"; '' for no price. */
export function priceInput(cents: number | null): string {
  if (cents === null) return ''
  return cents % 100 === 0 ? String(cents / 100) : (cents / 100).toFixed(2)
}

/** The currency's symbol for an input prefix, e.g. "$" or "CA$". */
export function currencySymbol(currency: string): string {
  return (SYMBOLS[currency] ?? currency).trim()
}
