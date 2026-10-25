import { describe, expect, it } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import TaskSubtasks from '@/components/tasks/TaskSubtasks.vue'
import { t } from '@/i18n'
import { useToasts } from '@/composables/useToasts'
import { api, render, status } from '../../../helpers'
import { $, button, click, press, type } from '../../../dom'
import { makeTask, makeUser } from '../../../fixtures'

const me = makeUser()
const parent = makeTask({ id: 'p-1', title: 'Landing' })

describe('TaskSubtasks', () => {
  it('lists the subtasks with how many are done, their prices together, and links to each', async () => {
    api({
      'GET /tasks/p-1/subtasks': {
        tasks: [
          makeTask({ id: 's-1', title: 'Header', status: 'done', status_name: 'Done', price_cents: 60000, parent_id: 'p-1' }),
          makeTask({ id: 's-2', title: 'Form', price_cents: 40000, parent_id: 'p-1' }),
        ],
      },
    })
    const view = await render(TaskSubtasks, { props: { task: parent }, user: me })
    expect(view.get('h2').text()).toContain('1/2')
    expect(view.get('[role="progressbar"]').attributes('aria-valuenow')).toBe('1')
    expect(view.get('a[href="/tasks/s-1"]').classes()).toContain('line-through')
    expect(view.get('a[href="/tasks/s-2"]').classes()).not.toContain('line-through')
    expect(view.text()).toContain(t('subtasks.total'))
    expect(view.text()).toContain('$1,000.00')
  })

  it('adds subtasks one after another by their titles and tells the page', async () => {
    const server = api({
      'GET /tasks/p-1/subtasks': { tasks: [] },
      'POST /tasks': ({ body }: { body: { title: string } }) => ({ task: makeTask({ id: `s-${body.title}`, title: body.title, parent_id: 'p-1' }) }),
    })
    const view = await render(TaskSubtasks, { props: { task: parent }, user: me })
    expect(view.text()).toContain(t('subtasks.empty'))

    await click(button(t('subtasks.add')))
    const input = $('#subtask-title') as HTMLInputElement
    await type(input, 'Header')
    await press('Enter', input)
    await flushPromises()
    expect(server.to('POST /tasks')[0].body).toEqual({ parent_id: 'p-1', title: 'Header', description: '', due_on: null })
    expect(view.text()).toContain('Header')
    expect(view.emitted('changed')).toHaveLength(1)

    // Still open for the next one; Esc closes it.
    expect($('#subtask-title')).not.toBeNull()
    await press('Escape', $('#subtask-title'))
    expect($('#subtask-title')).toBeNull()
  })

  it('says why a subtask couldn’t be added', async () => {
    api({
      'GET /tasks/p-1/subtasks': { tasks: [] },
      'POST /tasks': status(409, { error: { code: 'conflict', message: 'This task is archived' } }),
    })
    await render(TaskSubtasks, { props: { task: parent }, user: me })
    await click(button(t('subtasks.add')))
    const input = $('#subtask-title') as HTMLInputElement
    await type(input, 'Late')
    await press('Enter', input)
    await flushPromises()
    expect(useToasts().toasts.at(-1)?.message).toBe('This task is archived')
  })

  it('takes no new subtasks on a task that can’t be split', async () => {
    api({ 'GET /tasks/p-1/subtasks': { tasks: [] } })
    const view = await render(TaskSubtasks, { props: { task: { ...parent, can_add_subtask: false } }, user: me })
    expect(view.text()).not.toContain(t('subtasks.add'))
    expect(view.text()).toContain(t('subtasks.none'))
  })
})
