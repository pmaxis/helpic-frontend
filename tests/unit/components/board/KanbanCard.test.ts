import { afterEach, describe, expect, it, vi } from 'vitest'
import KanbanCard from '@/components/board/KanbanCard.vue'
import BoardScroller from '@/components/board/BoardScroller.vue'
import { t } from '@/i18n'
import { render } from '../../../helpers'
import { $, drag, place } from '../../../dom'
import { makeTask, makeUser } from '../../../fixtures'

afterEach(() => {
  vi.useRealTimers()
})

describe('KanbanCard', () => {
  const labels = ['Bug', 'UI', 'Copy', 'SEO'].map((name, i) => ({ id: `l${i}`, name, color: 'red' }))

  it('shows the project and two labels, folding the rest into +N', async () => {
    const view = await render(KanbanCard, { props: { task: makeTask({ labels, project: { id: 'p', name: 'Landing' } }), hideProject: false, dragging: false }, user: makeUser() })
    expect(view.text()).toContain('Landing')
    expect(view.text()).toContain('Bug')
    expect(view.text()).not.toContain('Copy')
    expect(view.get(`[aria-label="${t('board.moreLabels', { names: 'Copy, SEO' })}"]`).text()).toBe('+2')
  })

  it('reds an open task’s past due date, and hides the project on a project’s board', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(2030, 0, 20))
    const late = await render(KanbanCard, { props: { task: makeTask({ due_on: '2030-01-10', project: { id: 'p', name: 'Landing' } }), hideProject: true, dragging: false }, user: makeUser() })
    expect(late.find('.text-red-600').text()).toContain('10 Jan 2030')
    expect(late.text()).not.toContain('Landing')
    const done = await render(KanbanCard, { props: { task: makeTask({ due_on: '2030-01-10', status: 'done' }), hideProject: false, dragging: true }, user: makeUser() })
    expect(done.find('.text-red-600').exists()).toBe(false)
    expect(done.classes()).toContain('opacity-40')
  })

  it('has a pencil for whoever may edit, and a bin for whoever may delete', async () => {
    const view = await render(KanbanCard, { props: { task: makeTask({ title: 'Logo' }), hideProject: false, dragging: false }, user: makeUser() })
    await view.get(`[aria-label="${t('board.editTaskNamed', { title: 'Logo' })}"]`).trigger('click')
    expect(view.emitted('edit')).toHaveLength(1)
    await view.get(`[aria-label="${t('board.deleteTaskNamed', { title: 'Logo' })}"]`).trigger('click')
    expect(view.emitted('delete')).toHaveLength(1)
    const editOnly = await render(KanbanCard, { props: { task: makeTask({ title: 'Logo', can_delete: false }), hideProject: false, dragging: false }, user: makeUser() })
    expect(editOnly.findAll('button')).toHaveLength(1)
    expect(editOnly.find(`[aria-label="${t('board.deleteTaskNamed', { title: 'Logo' })}"]`).exists()).toBe(false)
    const readOnly = await render(KanbanCard, { props: { task: makeTask({ can_edit: false, can_delete: false }), hideProject: false, dragging: false }, user: makeUser() })
    expect(readOnly.find('button').exists()).toBe(false)
  })
})

describe('BoardScroller', () => {
  /** A board 1000px wide in a 400px window onto it. */
  async function mountScroller(dragging = false) {
    const view = await render(BoardScroller, { props: { dragging }, slots: { default: '<div class="row" style="width:1000px"></div>' } })
    const scroller = view.find('.no-scrollbar').element as HTMLElement
    Object.defineProperty(scroller, 'clientWidth', { value: 400, configurable: true })
    Object.defineProperty(scroller, 'scrollWidth', { value: 1000, configurable: true })
    scroller.dispatchEvent(new Event('scroll'))
    await view.vm.$nextTick()
    return { view, scroller }
  }

  it('draws its own scrollbar once the board is wider than the window, showing while it scrolls', async () => {
    vi.useFakeTimers()
    const { scroller } = await mountScroller()
    const thumb = $('[data-thumb]')!
    expect(thumb.style.width).toBe('160px')
    expect(thumb.className).toContain('opacity-100')
    scroller.scrollLeft = 300
    scroller.dispatchEvent(new Event('scroll'))
    await vi.advanceTimersByTimeAsync(1000)
    expect(thumb.style.transform).toBe('translateX(120px)')
    expect(thumb.className).toContain('opacity-0')
  })

  it('scrolls as the thumb is dragged, and jumps where the track is clicked', async () => {
    const { scroller } = await mountScroller()
    const thumb = $('[data-thumb]')!
    thumb.dispatchEvent(Object.assign(new Event('pointerdown', { bubbles: true, cancelable: true }), { clientX: 0 }))
    window.dispatchEvent(Object.assign(new Event('pointermove'), { clientX: 120 }))
    expect(scroller.scrollLeft).toBe(300)
    window.dispatchEvent(new Event('pointerup'))

    scroller.scrollTo = vi.fn()
    const track = $('[data-scrollbar]')!
    place(track, { left: 0, width: 400 })
    track.dispatchEvent(Object.assign(new Event('pointerdown', { bubbles: true }), { clientX: 400 }))
    expect(scroller.scrollTo).toHaveBeenCalledWith({ left: 600, behavior: 'smooth' })
    track.dispatchEvent(new Event('mouseenter'))
    track.dispatchEvent(new Event('mouseleave'))
  })

  it('pans when an empty part is grabbed, but not from a card or with touch', async () => {
    const { scroller } = await mountScroller()
    scroller.scrollLeft = 200
    const row = scroller.querySelector('.row')!
    row.dispatchEvent(Object.assign(new Event('pointerdown', { bubbles: true }), { button: 0, pointerType: 'mouse', clientX: 300 }))
    window.dispatchEvent(Object.assign(new Event('pointermove'), { clientX: 250 }))
    expect(scroller.scrollLeft).toBe(250)
    window.dispatchEvent(new Event('pointerup'))
    row.dispatchEvent(Object.assign(new Event('pointerdown', { bubbles: true }), { button: 0, pointerType: 'touch', clientX: 300 }))
    window.dispatchEvent(Object.assign(new Event('pointermove'), { clientX: 0 }))
    expect(scroller.scrollLeft).toBe(250)
  })

  it('scrolls toward an edge while something is dragged near it', async () => {
    const { scroller } = await mountScroller(true)
    place(scroller, { left: 0, width: 400 })
    scroller.scrollLeft = 300
    drag(scroller, 'dragover', { x: 390 })
    expect(scroller.scrollLeft).toBeGreaterThan(300)
    drag(scroller, 'dragover', { x: 10 })
    drag(scroller, 'dragover', { x: 200 })
    expect(scroller.scrollLeft).toBeLessThan(330)
  })
})
