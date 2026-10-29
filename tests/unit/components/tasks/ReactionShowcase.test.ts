import { afterEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import ReactionShowcase from '@/components/tasks/ReactionShowcase.vue'

afterEach(() => {
  vi.useRealTimers()
})

function mountReactions(reduceMotion = false) {
  vi.spyOn(window, 'matchMedia').mockReturnValue({ matches: reduceMotion, addEventListener: () => {}, removeEventListener: () => {} } as never)
  return mount(ReactionShowcase, { attachTo: document.body })
}

const reaction = (view: ReturnType<typeof mountReactions>, emoji: string) => view.findAll('button').find((b) => b.text().includes(emoji))!

describe('ReactionShowcase', () => {
  it('counts each reaction and sends its emoji floating up, for a moment', async () => {
    vi.useFakeTimers()
    const view = mountReactions()
    expect(view.find('[aria-hidden="true"]').exists()).toBe(true)
    expect(view.findAll('button').map((b) => b.text())).toEqual(['👍0', '🔥0', '👏0'])

    await reaction(view, '🔥').trigger('click')
    await reaction(view, '🔥').trigger('click')
    await reaction(view, '👏').trigger('click')
    expect(view.findAll('button').map((b) => b.text())).toEqual(['👍0', '🔥2', '👏1'])
    expect(view.findAll('.floater').map((f) => f.text())).toEqual(['🔥', '🔥', '👏'])

    vi.advanceTimersByTime(1500)
    await view.vm.$nextTick()
    expect(view.findAll('.floater')).toHaveLength(0)
    expect(reaction(view, '🔥').text()).toBe('🔥2')
  })

  it('keeps no more than two dozen in the air', async () => {
    const view = mountReactions()
    for (let i = 0; i < 40; i++) await reaction(view, '👍').trigger('click')
    expect(reaction(view, '👍').text()).toBe('👍40')
    expect(view.findAll('.floater')).toHaveLength(24)
  })

  it('only counts when motion is reduced', async () => {
    const view = mountReactions(true)
    await reaction(view, '👍').trigger('click')
    expect(reaction(view, '👍').text()).toBe('👍1')
    expect(view.findAll('.floater')).toHaveLength(0)
  })
})
