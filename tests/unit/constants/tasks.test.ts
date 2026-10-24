import { describe, expect, it } from 'vitest'
import { columnName, LABEL_COLOR_NAMES, LABEL_COLORS, PRIORITY_ORDER, priorityLabel, priorityOptions, statusLabel } from '@/constants/tasks'
import { setLocale } from '@/i18n'

describe('task constants', () => {
  it('lists the priorities most urgent first, worded in the interface language', () => {
    expect(priorityOptions().map((o) => o.value)).toEqual(PRIORITY_ORDER)
    const english = priorityLabel('urgent')
    setLocale('uk')
    expect(priorityLabel('urgent')).not.toBe(english)
  })

  it('translates the columns Helpic makes, and leaves the user’s own names alone', () => {
    setLocale('uk')
    expect(columnName('Done')).toBe(statusLabel('done'))
    expect(columnName('Paid')).not.toBe('Paid')
    expect(columnName('Waiting on legal')).toBe('Waiting on legal')
  })

  it('has a chip and a dot for every label colour', () => {
    for (const name of LABEL_COLOR_NAMES) expect(Object.keys(LABEL_COLORS[name])).toEqual(['chip', 'dot'])
  })
})
