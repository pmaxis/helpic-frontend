import { describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import TaskTitle from '@/components/tasks/TaskTitle.vue'
import { makeTask } from '../../../fixtures'

function mountTitle(save = vi.fn().mockResolvedValue(true), over = {}) {
  return mount(TaskTitle, { props: { task: makeTask({ title: 'Old title', ...over }), saving: false, save } })
}

describe('TaskTitle', () => {
  it('turns into a field on a click and saves the trimmed title on Enter', async () => {
    const save = vi.fn().mockResolvedValue(true)
    const title = mountTitle(save)
    await title.get('h1 button').trigger('click')
    const input = title.get('input')
    expect((input.element as HTMLInputElement).value).toBe('Old title')

    await input.setValue('  New title ')
    await input.trigger('keydown', { key: 'Enter' })
    await flushPromises()
    expect(save).toHaveBeenCalledWith({ title: 'New title' })
    expect(title.find('input').exists()).toBe(false)
  })

  it('goes back without saving when the title is emptied or unchanged', async () => {
    const save = vi.fn()
    const title = mountTitle(save)
    for (const value of ['   ', 'Old title']) {
      await title.get('h1 button').trigger('click')
      await title.get('input').setValue(value)
      await title.get('input').trigger('keydown', { key: 'Enter' })
      expect(title.find('input').exists()).toBe(false)
    }
    expect(save).not.toHaveBeenCalled()
  })

  it('stays a field when the save is refused, to try again', async () => {
    const title = mountTitle(vi.fn().mockResolvedValue(false))
    await title.get('h1 button').trigger('click')
    await title.get('input').setValue('New title')
    await title.get('input').trigger('keydown', { key: 'Enter' })
    await flushPromises()
    expect(title.find('input').exists()).toBe(true)
  })

  it('is plain text for whoever may not edit the task', () => {
    const title = mountTitle(vi.fn(), { can_edit: false })
    expect(title.find('h1 button').exists()).toBe(false)
    expect(title.get('h1').text()).toBe('Old title')
  })
})
