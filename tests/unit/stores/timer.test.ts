import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useTimerStore } from '@/stores/timer'
import { startTimer, stopTimer } from '@/services/time'
import { makeTimeEntry } from '../../fixtures'

vi.mock('@/services/time', () => ({
  fetchTimer: vi.fn(),
  startTimer: vi.fn(),
  stopTimer: vi.fn(),
}))

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2030-01-15T12:00:00Z'))
})

afterEach(() => {
  useTimerStore().reset()
  vi.useRealTimers()
})

describe('timer', () => {
  it('counts the time before the start and the time since, ticking each second', () => {
    const timer = useTimerStore()
    timer.set(makeTimeEntry({ seconds: 60, running_since: '2030-01-15T11:59:00Z' }))
    expect(timer.elapsed).toBe(120)
    vi.advanceTimersByTime(3000)
    expect(timer.elapsed).toBe(123)
  })

  it('has nothing elapsed without a running entry', () => {
    expect(useTimerStore().elapsed).toBe(0)
  })

  it('tells the task it left and the task it started on', async () => {
    const timer = useTimerStore()
    timer.set(makeTimeEntry({ task_id: 'old', running_since: '2030-01-15T11:00:00Z' }))
    vi.mocked(startTimer).mockResolvedValue(makeTimeEntry({ task_id: 'new', running_since: '2030-01-15T12:00:00Z' }))

    await timer.start('new')
    expect(timer.running?.task_id).toBe('new')
    expect(timer.touched).toEqual(['old', 'new'])
    expect(timer.version).toBe(1)
  })

  it('stops, and tells the task it ran on', async () => {
    const timer = useTimerStore()
    timer.set(makeTimeEntry({ task_id: 't-9', running_since: '2030-01-15T11:00:00Z' }))
    vi.mocked(stopTimer).mockResolvedValue(makeTimeEntry({ task_id: 't-9' }))

    await timer.stop()
    expect(timer.running).toBeNull()
    expect(timer.touched).toEqual(['t-9'])
    vi.advanceTimersByTime(5000)
    expect(timer.now).toBe(new Date('2030-01-15T12:00:00Z').getTime())
  })
})
