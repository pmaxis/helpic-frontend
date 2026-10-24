import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import KanbanColumnHeader from '@/components/board/KanbanColumnHeader.vue'
import { makeColumn } from '../../../fixtures'

function mountHeader(props: Partial<{ canManage: boolean; canMoveLeft: boolean; canMoveRight: boolean }> = {}) {
  return mount(KanbanColumnHeader, {
    props: { column: makeColumn({ name: 'Review' }), count: 3, canManage: true, canMoveLeft: true, canMoveRight: true, ...props },
    attachTo: document.body,
  })
}

describe('KanbanColumnHeader', () => {
  it('renames on a click on the name, sending the trimmed name only when it changed', async () => {
    const header = mountHeader()
    await header.get('h3').trigger('click')
    expect(header.get('header').attributes('draggable')).toBe('false')

    await header.get('input').setValue('  QA ')
    await header.get('input').trigger('keydown', { key: 'Enter' })
    expect(header.emitted('rename')).toEqual([['QA']])

    await header.get('h3').trigger('click')
    await header.get('input').trigger('keydown', { key: 'Enter' })
    expect(header.emitted('rename')).toHaveLength(1)
    header.unmount()
  })

  it('cancels a rename on Escape', async () => {
    const header = mountHeader()
    await header.get('h3').trigger('click')
    await header.get('input').setValue('QA')
    await header.get('input').trigger('keydown', { key: 'Escape' })
    expect(header.find('input').exists()).toBe(false)
    expect(header.emitted('rename')).toBeUndefined()
    header.unmount()
  })

  it('offers only the moves there is room for', async () => {
    const header = mountHeader({ canMoveLeft: false })
    await header.get('button[aria-haspopup="menu"]').trigger('click')
    const items = header.findAll('[role="menuitem"]')
    expect(items.map((b) => b.text())).toEqual(['Edit', 'Move right', 'Delete'])

    await items[1].trigger('click')
    expect(header.emitted('shift')).toEqual([[1]])
    header.unmount()
  })

  it('is neither draggable, renamable nor has a menu for whoever doesn’t manage the board', async () => {
    const header = mountHeader({ canManage: false })
    expect(header.get('header').attributes('draggable')).toBe('false')
    expect(header.find('button[aria-haspopup="menu"]').exists()).toBe(false)
    await header.get('h3').trigger('click')
    expect(header.find('input').exists()).toBe(false)
    expect(header.text()).toContain('3')
    header.unmount()
  })
})
