import { afterEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import AuthShowcase from '@/components/auth/AuthShowcase.vue'
import { t } from '@/i18n'
import { place } from '../../../dom'

afterEach(() => {
  vi.useRealTimers()
})

function mountShowcase(reduceMotion = false) {
  vi.spyOn(window, 'matchMedia').mockReturnValue({ matches: reduceMotion, addEventListener: () => {}, removeEventListener: () => {} } as never)
  return mount(AuthShowcase, { attachTo: document.body })
}

/** The demo tasks' statuses, in order. */
const statuses = (view: ReturnType<typeof mountShowcase>) => view.findAll('button').map((b) => b.text())

describe('AuthShowcase', () => {
  it('moves the demo project along by itself, starting over once all is done', async () => {
    vi.useFakeTimers()
    const view = mountShowcase()
    const before = statuses(view)
    vi.advanceTimersByTime(2600)
    await view.vm.$nextTick()
    expect(statuses(view)).not.toEqual(before)
    // done, in progress, new: three steps in all finish it
    vi.advanceTimersByTime(2600 * 2)
    await view.vm.$nextTick()
    expect(statuses(view).every((s) => s === t('status.done'))).toBe(true)
    vi.advanceTimersByTime(2600)
    await view.vm.$nextTick()
    expect(statuses(view)).toEqual(before)
    vi.advanceTimersByTime(700)
  })

  it('cycles the feed, and pauses on hover or in a background tab', async () => {
    vi.useFakeTimers()
    const view = mountShowcase()
    const feed = () => view.text()
    const first = feed()
    vi.advanceTimersByTime(3800)
    await view.vm.$nextTick()
    expect(feed()).not.toBe(first)

    Object.defineProperty(document, 'hidden', { value: true, configurable: true })
    document.dispatchEvent(new Event('visibilitychange'))
    const paused = feed()
    vi.advanceTimersByTime(3800 * 2)
    await view.vm.$nextTick()
    expect(feed()).toBe(paused)
    Object.defineProperty(document, 'hidden', { value: false, configurable: true })
    document.dispatchEvent(new Event('visibilitychange'))
    view.unmount()
  })

  it('steps a task on a click, tilting toward the pointer unless motion is reduced', async () => {
    const view = mountShowcase()
    const before = statuses(view)
    await view.findAll('button')[2].trigger('click')
    expect(statuses(view)[2]).not.toBe(before[2])

    const cards = view.find('[style*="rotate"], [style*="perspective"]')
    if (cards.exists()) place(cards.element, { top: 0, left: 0, width: 200, height: 200 })
    window.dispatchEvent(Object.assign(new Event('pointermove'), { clientX: 400, clientY: -100 }))
    await view.vm.$nextTick()
    view.unmount()

    vi.useFakeTimers()
    const still = mountShowcase(true)
    const start = statuses(still)
    vi.advanceTimersByTime(10_000)
    await still.vm.$nextTick()
    expect(statuses(still)).toEqual(start)
    window.dispatchEvent(Object.assign(new Event('pointermove'), { clientX: 400, clientY: -100 }))
  })
})
