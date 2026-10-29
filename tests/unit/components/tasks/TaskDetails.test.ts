import { afterEach, describe, expect, it, vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import TaskDetails from '@/components/tasks/TaskDetails.vue'
import TaskDescription from '@/components/tasks/TaskDescription.vue'
import TaskArchivedNote from '@/components/tasks/TaskArchivedNote.vue'
import { t } from '@/i18n'
import { useTimerStore } from '@/stores/timer'
import { useToasts } from '@/composables/useToasts'
import type { Task } from '@/types/tasks'
import { api, render, status, type Reply } from '../../../helpers'
import { $, $$, button, choose, click, field, press, type } from '../../../dom'
import { makeColumn, makeProject, makeTask, makeTimeEntry, makeUser } from '../../../fixtures'

const me = makeUser()

afterEach(() => {
  useTimerStore().reset()
  vi.useRealTimers()
})

const COLUMNS = [
  makeColumn({ id: 'c-todo', name: 'New', category: 'new' }),
  makeColumn({ id: 'c-doing', name: 'In progress', category: 'in_progress' }),
  makeColumn({ id: 'c-done', name: 'Done', category: 'done' }),
]

/** The task page's API: the task, its board, and the empty lists around it. */
function serve(task: Task = makeTask(), extra: Record<string, Reply> = {}) {
  return api({
    [`GET /tasks/${task.id}`]: { task },
    'GET /board/columns': { can_manage: false, columns: COLUMNS },
    'GET /projects': { projects: [makeProject({ id: 'p-1', name: 'Landing' })] },
    'GET /attachments': { attachments: [], max_size_bytes: 1024 },
    'GET /comments': { comments: [] },
    'GET /time-entries': { entries: [] },
    [`GET /tasks/${task.id}/history`]: { events: [] },
    [`GET /tasks/${task.id}/people`]: { people: [] },
    'GET /board/labels': { labels: [] },
    ...extra,
  })
}

/** Answers a change to the task with the task as changed. */
const changed = (base: Task, over: Partial<Task>) => ({ task: { ...base, ...over } })

describe('TaskDetails', () => {
  it('loads the task, shows it and its details, and tells the page', async () => {
    const task = makeTask({ description: 'The hero and the footer', project: { id: 'p-1', name: 'Landing' } })
    serve(task)
    const page = await render(TaskDetails, { props: { taskId: 't-1' }, user: me })
    expect(page.text()).toContain('Write the landing page')
    expect(page.text()).toContain('The hero and the footer')
    expect(page.text()).toContain(t('task.details'))
    expect(page.emitted('loaded')?.[0][0]).toMatchObject({ id: 't-1' })
  })

  it('says a task that isn’t there can’t be found', async () => {
    api({ 'GET /tasks/gone': status(404) })
    const page = await render(TaskDetails, { props: { taskId: 'gone' }, user: me })
    expect(page.text()).toContain(t('task.notFound'))
    expect(page.emitted('loaded')).toEqual([[null]])

    api({ 'GET /tasks/x': status(500) })
    await page.setProps({ taskId: 'x' })
    await flushPromises()
    expect(useToasts().toasts.at(-1)?.message).toBe(t('task.loadFailed'))
  })

  it('renames the task in place, sending its other fields as they are', async () => {
    const task = makeTask({ description: 'Keep me', due_on: '2030-02-01' })
    const server = serve(task, { 'PUT /tasks/t-1': changed(task, { title: 'Renamed' }) })
    const page = await render(TaskDetails, { props: { taskId: 't-1' }, user: me })
    await click(page.get('h1 button').element)
    await type(page.get('input#task-title-input').element as HTMLInputElement, 'Renamed')
    await press('Enter', $('#task-title-input'))
    await flushPromises()
    expect(server.to('PUT /tasks/t-1')[0].body).toEqual({ title: 'Renamed', description: 'Keep me', due_on: '2030-02-01' })
    expect(page.emitted('changed')?.at(-1)?.[0]).toMatchObject({ title: 'Renamed' })
  })

  it('shows the field the API refused when a save fails', async () => {
    const task = makeTask()
    serve(task, { 'PUT /tasks/t-1': status(422, { error: { code: 'V', message: 'Bad', fields: { title: 'Too long' } } }) })
    const page = await render(TaskDetails, { props: { taskId: 't-1' }, user: me })
    await click(page.get('h1 button').element)
    await type($('#task-title-input') as HTMLInputElement, 'x'.repeat(10))
    await press('Enter', $('#task-title-input'))
    await flushPromises()
    expect(useToasts().toasts.at(-1)?.message).toBe('Too long')
    expect($('#task-title-input')).not.toBeNull()
  })

  it('moves the task to a column the viewer may use', async () => {
    const task = makeTask()
    const server = serve(task, { 'POST /tasks/t-1/status': changed(task, { status_id: 'c-done', status: 'done', status_name: 'Done' }) })
    await render(TaskDetails, { props: { taskId: 't-1' }, user: me })
    await choose(t('task.status'), t('status.done'))
    expect(server.to('POST /tasks/t-1/status')[0].body).toEqual({ status_id: 'c-done' })
  })

  it('falls back to the pair’s board when the project’s columns fail', async () => {
    const task = makeTask({ project: { id: 'p-1', name: 'Landing' } })
    const server = serve(task, { 'GET /board/columns': (c: { params: { project?: string } }) => (c.params.project ? status(500) : { can_manage: true, columns: COLUMNS }) })
    await render(TaskDetails, { props: { taskId: 't-1' }, user: me })
    expect(server.to('GET /board/columns').map((c) => c.params)).toEqual([{ project: 'p-1' }, { with: 'u-client' }])
  })

  it('lets a client move only into columns open to them, unless they manage the board', async () => {
    const client = makeUser({ id: 'u-client', role: 'client' })
    const columns = [COLUMNS[0], { ...COLUMNS[2], participants_can_move: false }]
    serve(makeTask(), { 'GET /board/columns': { can_manage: false, columns } })
    await render(TaskDetails, { props: { taskId: 't-1' }, user: client })
    expect($(`[aria-label="${t('task.status')}"]`)).toBeNull()
  })

  it('sets the priority and the due date, and moves the task to another project', async () => {
    const task = makeTask()
    const server = serve(task, {
      'PUT /tasks/t-1/priority': changed(task, { priority: 'urgent' }),
      'PUT /tasks/t-1': changed(task, {}),
    })
    await render(TaskDetails, { props: { taskId: 't-1' }, user: me })
    await choose(t('task.priority'), t('priority.urgent'))
    expect(server.to('PUT /tasks/t-1/priority')[0].body).toEqual({ priority: 'urgent' })

    await choose(t('task.project'), 'Landing')
    expect(server.to('PUT /tasks/t-1')[0].body).toMatchObject({ project_id: 'p-1' })

    await click(field(t('task.dueDate')))
    await click($$('[role="gridcell"]')[10])
    expect(server.to('PUT /tasks/t-1')[1].body).toMatchObject({ due_on: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/) })
  })

  it('moves the creation date into the past, keeping its time of day', async () => {
    const task = makeTask({ created_at: '2030-01-10T09:00:00Z' })
    vi.useFakeTimers({ now: new Date('2030-01-20T12:00:00Z'), toFake: ['Date'] })
    try {
      const server = serve(task, { 'PUT /tasks/t-1': changed(task, {}) })
      await render(TaskDetails, { props: { taskId: 't-1' }, user: me })
      await click(field(t('task.createdOn')))
      const day = (iso: string) => $(`[role="gridcell"][data-iso="${iso}"]`) as HTMLElement
      // no clearing it, and no day after today
      expect(field(t('task.createdOn')).nextElementSibling).toBeNull()
      expect(day('2030-01-25').getAttribute('aria-disabled')).toBe('true')
      await click(day('2030-01-25'))
      expect(server.to('PUT /tasks/t-1')).toHaveLength(0)

      await click(day('2030-01-03'))
      const sent = server.to('PUT /tasks/t-1')[0].body as { created_at: string }
      expect(sent).toMatchObject({ title: task.title, description: task.description, due_on: task.due_on })
      // the same moment of the day, on the 3rd, written in the local offset
      expect(sent.created_at).toMatch(/^2030-01-03T\d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2}$/)
      const at = new Date(task.created_at)
      at.setFullYear(2030, 0, 3)
      expect(new Date(sent.created_at).getTime()).toBe(at.getTime())
    } finally {
      vi.useRealTimers()
    }
  })

  it('keeps the creation date on or before the due date', async () => {
    vi.useFakeTimers({ now: new Date('2030-01-20T12:00:00Z'), toFake: ['Date'] })
    try {
      serve(makeTask({ created_at: '2030-01-10T09:00:00Z', due_on: '2030-01-12' }))
      await render(TaskDetails, { props: { taskId: 't-1' }, user: me })
      await click(field(t('task.createdOn')))
      const day = (iso: string) => $(`[role="gridcell"][data-iso="${iso}"]`) as HTMLElement
      expect(day('2030-01-12').getAttribute('aria-disabled')).toBeNull()
      expect(day('2030-01-13').getAttribute('aria-disabled')).toBe('true')
    } finally {
      vi.useRealTimers()
    }
  })

  it('sets a fixed price, or bills by the hour with what the hours come to', async () => {
    const task = makeTask()
    const server = serve(task, {
      'PUT /tasks/t-1/price': (c: { body: { billing: string } }) =>
        c.body.billing === 'hourly'
          ? changed(task, { billing: 'hourly', price_cents: 6000, tracked_seconds: 5400, hourly_rate_cents: 4000 })
          : changed(task, { price_cents: 120000 }),
    })
    const page = await render(TaskDetails, { props: { taskId: 't-1' }, user: me })
    await click(button(t('task.clickToSetPrice')))
    const price = $(`input[aria-label="${t('task.price')}"]`) as HTMLInputElement
    await type(price, '1200')
    await press('Enter', price)
    await flushPromises()
    expect(server.to('PUT /tasks/t-1/price')[0].body).toEqual({ billing: 'fixed', price: '1200' })
    expect(page.text()).toContain('$1,200.00')

    await click(button(t('timelog.hourly')))
    expect(server.to('PUT /tasks/t-1/price')[1].body).toEqual({ billing: 'hourly', price: null })
    expect(page.text()).toContain('1h 30m × $40/h')
  })

  it('leaves an unchanged price alone, and keeps the field open when it is refused', async () => {
    const task = makeTask({ price_cents: 1000 })
    const server = serve(task, { 'PUT /tasks/t-1/price': status(422, { error: { code: 'V', message: 'x', fields: { price: 'Too much' } } }) })
    await render(TaskDetails, { props: { taskId: 't-1' }, user: me })
    await click(button(t('task.clickToSetPrice')))
    await press('Enter', $(`input[aria-label="${t('task.price')}"]`))
    expect(server.to('PUT /tasks/t-1/price')).toHaveLength(0)
    await click(button(t('task.clickToSetPrice')))
    await type($(`input[aria-label="${t('task.price')}"]`) as HTMLInputElement, '999999')
    await press('Enter', $(`input[aria-label="${t('task.price')}"]`))
    await flushPromises()
    expect(useToasts().toasts.at(-1)?.message).toBe('Too much')
  })

  it('points to the settings when an hourly task has no rate', async () => {
    serve(makeTask({ billing: 'hourly' }))
    const page = await render(TaskDetails, { props: { taskId: 't-1' }, user: me })
    expect(page.find('a[href="/settings"]').exists()).toBe(true)
  })

  it('starts and stops the timer, and reloads when it touched the task', async () => {
    const task = makeTask({ tracked_seconds: 0 })
    const server = serve(task, {
      'POST /timer': { timer: makeTimeEntry({ running_since: new Date().toISOString() }) },
      'POST /timer/stop': { entry: makeTimeEntry() },
    })
    const page = await render(TaskDetails, { props: { taskId: 't-1' }, user: me })
    await click(button(t('timelog.start')))
    expect(server.to('POST /timer')[0].params).toEqual({ task: 't-1' })
    expect(page.text()).toMatch(/0:00:0\d/)
    await flushPromises()
    expect(server.to('GET /tasks/t-1')).toHaveLength(2)
    await click(button(t('timelog.stop')))
    expect(server.to('POST /timer/stop')).toHaveLength(1)
  })

  it('says when the timer can’t start', async () => {
    serve(makeTask(), { 'POST /timer': status(409, { error: { code: 'X', message: 'Already running' } }) })
    await render(TaskDetails, { props: { taskId: 't-1' }, user: me })
    await click(button(t('timelog.start')))
    expect(useToasts().toasts.at(-1)?.message).toBe('Already running')
  })

  it('archives a personal task after asking', async () => {
    const task = makeTask({ client: null, can_archive: true })
    const server = serve(task, { 'POST /tasks/t-1/archive': changed(task, { archived_at: '2030-02-01T00:00:00Z' }) })
    const page = await render(TaskDetails, { props: { taskId: 't-1' }, user: me })
    await click(button(t('task.options')))
    await click(button(t('task.archive')))
    await click($$('[role="dialog"] button').find((b) => b.textContent?.trim() === t('task.archive'))!)
    expect(server.to('POST /tasks/t-1/archive')).toHaveLength(1)
    expect(page.text()).toContain(t('task.archivedClosed'))
  })

  it('deletes the task after asking, telling the page', async () => {
    const server = serve()
    const page = await render(TaskDetails, { props: { taskId: 't-1' }, user: me })
    await click(button(t('task.options')))
    await click(button(t('task.delete')))
    await click($$('[role="dialog"] button').find((b) => b.textContent?.trim() === t('common.delete'))!)
    expect(server.to('DELETE /tasks/t-1')).toHaveLength(1)
    expect(page.emitted('deleted')).toHaveLength(1)

    server.reply('DELETE /tasks/t-1', status(409, { error: { code: 'X', message: 'Started' } }))
    await click(button(t('task.options')))
    await click(button(t('task.delete')))
    await click($$('[role="dialog"] button').find((b) => b.textContent?.trim() === t('common.delete'))!)
    expect(useToasts().toasts.at(-1)?.message).toBe('Started')
  })

  it('opens the whole form from the menu, and shows what it saved', async () => {
    const task = makeTask()
    serve(task, { 'PUT /tasks/t-1': changed(task, { title: 'From the form' }) })
    const page = await render(TaskDetails, { props: { taskId: 't-1' }, user: me })
    await click(button(t('task.options')))
    await click(button(t('task.edit')))
    await click($$('[role="dialog"] button').find((b) => b.textContent?.trim() === t('common.save'))!)
    expect(page.text()).toContain('From the form')
  })

  it('hides the details card and remembers it', async () => {
    serve()
    const page = await render(TaskDetails, { props: { taskId: 't-1' }, user: me })
    await click(button(t('task.hideDetails')))
    expect(page.find('aside').exists()).toBe(false)
    expect(localStorage.getItem('helpic:task-details-hidden')).toBe('1')
    await click(button(t('task.showDetails')))
    expect(page.find('aside').exists()).toBe(true)
  })

  it('shows an archived task as it was, nothing on it changeable', async () => {
    serve(makeTask({ archived_at: '2030-02-01T00:00:00Z', archived_by: { id: 'r-1', title: 'January' }, can_edit: false, priority: 'high', labels: [] }))
    const page = await render(TaskDetails, { props: { taskId: 't-1' }, user: me })
    expect(page.text()).toContain('January')
    expect(page.text()).toContain(t('priority.high'))
    expect($(`[aria-label="${t('task.priority')}"]`)).toBeNull()
    expect(page.find('h1 button').exists()).toBe(false)
  })

  it('shows who created the task and when it last changed', async () => {
    serve(makeTask({ creator: { id: 'x', name: 'Bo Li', email: 'b@x' }, updated_at: '2030-01-20T00:00:00Z' }))
    const page = await render(TaskDetails, { props: { taskId: 't-1' }, user: me })
    expect(page.text()).toContain('Bo Li')
    expect(page.text()).toContain(t('task.updated', { date: '20 Jan 2030' }))
  })
})

describe('TaskDescription', () => {
  const props = (over: Partial<Task> = {}, save = vi.fn().mockResolvedValue(true)) => ({ task: makeTask(over), saving: false, save })

  it('offers to add a description, and saves it with ⌘/Ctrl + Enter', async () => {
    const p = props()
    const view = await render(TaskDescription, { props: p })
    await click(button(t('task.addDescription')))
    await type(view.get('textarea').element as HTMLTextAreaElement, ' The hero ')
    await press('Enter', view.get('textarea').element, { metaKey: true })
    await flushPromises()
    expect(p.save).toHaveBeenCalledWith({ description: 'The hero' })
  })

  it('edits on a click unless text was being selected, and cancels on Escape', async () => {
    const p = props({ description: 'Old' })
    const view = await render(TaskDescription, { props: p })
    vi.spyOn(window, 'getSelection').mockReturnValueOnce({ toString: () => 'Ol' } as Selection)
    await click(view.get('[title]').element)
    expect(view.find('textarea').exists()).toBe(false)
    await click(view.get('[title]').element)
    await press('Escape', view.get('textarea').element)
    expect(view.find('textarea').exists()).toBe(false)
    expect(p.save).not.toHaveBeenCalled()

    await click(view.get('[title]').element)
    await press('Enter', view.get('textarea').element, { ctrlKey: true })
    expect(p.save).not.toHaveBeenCalled()
  })

  it('is plain text for whoever may not edit', async () => {
    const view = await render(TaskDescription, { props: props({ description: 'Read only', can_edit: false }) })
    await click(byTextSafe(view.element, 'Read only'))
    expect(view.find('textarea').exists()).toBe(false)
    expect(view.text()).not.toContain(t('task.addDescription'))
  })
})

describe('TaskArchivedNote', () => {
  it('names the report that archived the task, as text for a team member', async () => {
    const view = await render(TaskArchivedNote, { props: { archivedAt: '2030-02-01', archivedBy: { id: 'r-1', title: 'January' } }, user: me })
    expect(view.find('a[href="/reports/r-1"]').exists()).toBe(true)
    const member = makeUser({ role: 'client', member_of: { owner_id: 'o', name: 'Acme', role: 'member' } })
    const asMember = await render(TaskArchivedNote, { props: { archivedAt: '2030-02-01', archivedBy: { id: 'r-1', title: 'January' } }, user: member })
    expect(asMember.find('a').exists()).toBe(false)
    expect(asMember.text()).toContain('January')
  })
})

function byTextSafe(root: Element, text: string): Element {
  return [...root.querySelectorAll('*')].find((e) => e.children.length === 0 && e.textContent?.includes(text)) ?? root
}
