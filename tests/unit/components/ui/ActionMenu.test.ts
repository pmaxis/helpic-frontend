import { afterEach, describe, expect, it, vi } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import ActionMenu from '@/components/ui/ActionMenu.vue'

let wrapper: VueWrapper | undefined

afterEach(() => {
  wrapper?.unmount()
})

function mountMenu(onEdit = vi.fn()) {
  wrapper = mount(ActionMenu, {
    props: {
      label: 'Task options',
      actions: [
        { label: 'Edit', onSelect: onEdit },
        { label: 'Delete', danger: true, onSelect: vi.fn() },
      ],
    },
    attachTo: document.body,
  })
  return wrapper
}

describe('ActionMenu', () => {
  it('opens on its button and runs the picked action, then closes', async () => {
    const onEdit = vi.fn()
    const menu = mountMenu(onEdit)
    await menu.get('button[aria-label="Task options"]').trigger('click')
    const items = menu.findAll('[role="menuitem"]')
    expect(items.map((b) => b.text())).toEqual(['Edit', 'Delete'])
    expect(items[1].classes()).toContain('text-red-600')

    await items[0].trigger('click')
    expect(onEdit).toHaveBeenCalledOnce()
    expect(menu.find('[role="menu"]').exists()).toBe(false)
  })

  it('closes on a click outside and on Escape', async () => {
    const menu = mountMenu()
    const button = menu.get('button[aria-label="Task options"]')

    await button.trigger('click')
    document.body.dispatchEvent(new Event('pointerdown', { bubbles: true }))
    await menu.vm.$nextTick()
    expect(menu.find('[role="menu"]').exists()).toBe(false)

    await button.trigger('click')
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await menu.vm.$nextTick()
    expect(menu.find('[role="menu"]').exists()).toBe(false)
  })

  it('has a bare button in the plain variant', () => {
    wrapper = mount(ActionMenu, { props: { label: 'Column options', actions: [], variant: 'plain' } })
    const button = wrapper.get('button')
    expect(button.classes()).toContain('p-1')
    expect(button.classes()).not.toContain('border')
  })
})
