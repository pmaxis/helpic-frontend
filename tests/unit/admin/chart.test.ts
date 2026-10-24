import { afterEach, describe, expect, it, vi } from 'vitest'
import { change, compact, dayDate, niceTicks, pct, shortDay, timeAgoDay } from '@/admin/chart'
import { untilText } from '@/admin/limits'

afterEach(() => {
  vi.useRealTimers()
})

describe('admin chart helpers', () => {
  it('reads a day as a local calendar day', () => {
    expect(dayDate('2030-03-05')).toEqual(new Date(2030, 2, 5))
    expect(shortDay('2030-03-05')).toBe('5 Mar')
  })

  it('makes round, whole ticks reaching the top value', () => {
    expect(niceTicks(0)).toEqual([0, 1])
    expect(niceTicks(1)).toEqual([0, 1])
    expect(niceTicks(15)).toEqual([0, 5, 10, 15])
    expect(niceTicks(7)).toEqual([0, 5, 10])
    expect(niceTicks(1200)).toEqual([0, 500, 1000, 1500])
  })

  it('writes counts in full up to ten thousand, compact above', () => {
    expect(compact(1284)).toBe('1,284')
    expect(compact(12900)).toBe('12.9k')
  })

  it('gives shares and changes in whole percent', () => {
    expect(pct(1, 3)).toBe(33)
    expect(pct(5, 0)).toBe(0)
    expect(change(15, 10)).toBe(50)
    expect(change(5, 0)).toBeNull()
  })

  it('says how long ago a day was', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2030, 2, 20, 15))
    expect(timeAgoDay('2030-03-20')).toBe('Today')
    expect(timeAgoDay('2030-03-19')).toBe('Yesterday')
    expect(timeAgoDay('2030-03-15')).toBe('5 days ago')
    expect(timeAgoDay('2030-01-01')).toBe('1 Jan 2030')
  })

  it('says when a limit lifts, a started minute counting as one', () => {
    vi.useFakeTimers()
    const now = new Date(2030, 2, 20, 21, 0, 0)
    vi.setSystemTime(now)
    const at = (minutes: number) => new Date(now.getTime() + minutes * 60_000).toISOString()
    expect(untilText(at(0.2))).toMatch(/^21:00 · .*1 min/)
    expect(untilText(at(12))).toMatch(/^21:12 · .*12 min/)
    expect(untilText(at(90))).toMatch(/1 h 30 min/)
    expect(untilText(at(120))).toMatch(/2 h$/)
  })
})
