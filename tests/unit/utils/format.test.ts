import { afterEach, describe, expect, it, vi } from 'vitest'
import { deviceName, formatClock, formatDate, formatDuration, isOverdue, parseDevice, timeAgo } from '@/utils/format'
import { setLocale } from '@/i18n'

const MAC_CHROME = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36'
const IPHONE_SAFARI = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
const ANDROID_TABLET = 'Mozilla/5.0 (Linux; Android 14; SM-X710) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36'
const WINDOWS_EDGE = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36 Edg/130.0'

afterEach(() => {
  vi.useRealTimers()
})

describe('formatDate', () => {
  it('reads a YYYY-MM-DD date as a local day, not UTC midnight', () => {
    expect(formatDate('2030-01-15')).toBe('15 Jan 2030')
  })

  it('follows the interface language', () => {
    setLocale('uk')
    expect(formatDate('2030-01-15')).toMatch(/^15 січ\.? 2030/)
  })
})

describe('isOverdue', () => {
  it('is true only for a day before today', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2030, 0, 15, 12))
    expect(isOverdue('2030-01-14')).toBe(true)
    expect(isOverdue('2030-01-15')).toBe(false)
    expect(isOverdue('2030-01-16')).toBe(false)
    expect(isOverdue(null)).toBe(false)
  })
})

describe('timeAgo', () => {
  it('counts minutes, hours and days, then gives the date', () => {
    vi.useFakeTimers()
    const now = new Date('2030-01-15T12:00:00Z')
    vi.setSystemTime(now)
    const ago = (seconds: number) => new Date(now.getTime() - seconds * 1000).toISOString()
    expect(timeAgo(ago(30))).toBe('just now')
    expect(timeAgo(ago(5 * 60))).toBe('5m ago')
    expect(timeAgo(ago(3 * 3600))).toBe('3h ago')
    expect(timeAgo(ago(2 * 86400))).toBe('2d ago')
    expect(timeAgo('2030-01-01T12:00:00Z')).toBe('1 Jan 2030')
  })
})

describe('parseDevice', () => {
  it('tells the browser, the system and the form factor', () => {
    expect(parseDevice(MAC_CHROME)).toEqual({ browser: 'Chrome', os: 'macOS', kind: 'desktop' })
    expect(parseDevice(IPHONE_SAFARI)).toEqual({ browser: 'Safari', os: 'iOS', kind: 'phone' })
    expect(parseDevice(ANDROID_TABLET)).toEqual({ browser: 'Chrome', os: 'Android', kind: 'tablet' })
    expect(parseDevice(WINDOWS_EDGE).browser).toBe('Edge')
  })

  it('knows nothing about an empty user agent', () => {
    expect(parseDevice('')).toEqual({ browser: '', os: '', kind: 'unknown' })
  })
})

describe('deviceName', () => {
  it('names a device in the interface language', () => {
    expect(deviceName(MAC_CHROME)).toBe('Chrome on macOS')
    expect(deviceName('')).toBe('Unknown device')
    setLocale('uk')
    expect(deviceName(MAC_CHROME)).toBe('Chrome на macOS')
  })
})

describe('formatDuration', () => {
  it('rounds to the minute and leaves out what is zero', () => {
    expect(formatDuration(5400)).toBe('1h 30m')
    expect(formatDuration(7200)).toBe('2h')
    expect(formatDuration(2700)).toBe('45m')
    expect(formatDuration(89)).toBe('1m')
  })
})

describe('formatClock', () => {
  it('shows hours, minutes and seconds, never below zero', () => {
    expect(formatClock(309)).toBe('0:05:09')
    expect(formatClock(5400)).toBe('1:30:00')
    expect(formatClock(-3)).toBe('0:00:00')
  })
})
