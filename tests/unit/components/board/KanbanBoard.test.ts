import { describe, expect, it } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { nextTick } from 'vue'
import KanbanBoard from '@/components/board/KanbanBoard.vue'
import { t } from '@/i18n'
import { useBoardStore } from '@/stores/board'
import { useToasts } from '@/composables/useToasts'
import type { Task } from '@/types/tasks'
import { api, render, status } from '../../../helpers'
import { $, $$, button, byText, click, drag, field, place, type } from '../../../dom'
import { makeColumn, makeTask, makeUser } from '../../../fixtures'

const me = makeUser()

function seed(canManage = true) {
  const board = useBoardStore()
  board.canManage = canManage
  board.columns = [
    makeColumn({ id: 'todo', name: 'New', category: 'new', tasks: [makeTask({ id: 'a', title: 'Alpha', status_id: 'todo' }), makeTask({ id: 'b', title: 'Beta', status_id: 'todo' })] }),
    makeColumn({ id: 'doing', name: 'Review', category: 'in_progress', status_category: 'in_progress', tasks: [makeTask({ id: 'c', title: 'Gamma', status_id: 'doing', status: 'in_progress' })] }),
    makeColumn({ id: 'done', name: 'Done', category: 'done', status_category: 'done', participants_can_move: false }),
  ]
  return board
}

const columns = () => $$('section[data-column]')
const card = (id: string) => $(`[data-card="${id}"]`)!
const titles = (col: number) => [...columns()[col].querySelectorAll('[data-card] p')].map((p) => p.textContent?.trim())

/** Drags a card over a column at a height, then drops it there. */
async function dropCard(id: string, col: number, y = 1000) {
  drag(card(id), 'dragstart')
  await nextTick()
  drag(columns()[col], 'dragover', { y })
  await nextTick()
  drag(columns()[col], 'drop', { y })
  await flushPromises()
}

describe('KanbanBoard', () => {
  it('shows each column with its count and cards', async () => {
    seed()
    await render(KanbanBoard, { user: me })
    expect(columns().map((c) => c.getAttribute('aria-label'))).toEqual(['New', 'Review', 'Done'])
    expect(titles(0)).toEqual(['Alpha', 'Beta'])
  })

  it('drops a card at the end of another column, after its last card', async () => {
    seed()
    const server = api({ 'POST /board/moves': (c) => ({ task: makeTask({ id: (c.body as { task_id: string }).task_id, title: 'Alpha', status_id: 'doing' }) }) })
    await render(KanbanBoard, { user: me })
    await dropCard('a', 1)
    expect(server.to('POST /board/moves')[0].body).toEqual({ task_id: 'a', column_id: 'doing', after_task_id: 'c' })
    expect(titles(1)).toEqual(['Gamma', 'Alpha'])
  })

  it('drops a card before the first card whose middle is below the pointer', async () => {
    seed()
    const server = api({ 'POST /board/moves': { task: makeTask({ id: 'b', title: 'Beta' }) } })
    await render(KanbanBoard, { user: me })
    place(card('a'), { top: 100, height: 50 })
    drag(card('b'), 'dragstart')
    await nextTick()
    drag(columns()[0], 'dragover', { y: 110 })
    await nextTick()
    expect(columns()[0].querySelector('li[aria-hidden="true"]')).not.toBeNull()
    drag(columns()[0], 'drop', { y: 110 })
    await flushPromises()
    expect(server.to('POST /board/moves')[0].body).toMatchObject({ after_task_id: '' })
  })

  it('won’t take a card into a column the viewer may not use', async () => {
    seed(false)
    const server = api()
    await render(KanbanBoard, { user: makeUser({ role: 'client' }) })
    drag(card('a'), 'dragstart')
    await nextTick()
    expect(columns()[2].className).toContain('opacity-40')
    expect(drag(columns()[2], 'dragover').defaultPrevented).toBe(false)
    drag(card('a'), 'dragend')
    expect(server.calls).toHaveLength(0)
  })

  it('clears the drop spot when the pointer leaves the column, and puts a refused move back', async () => {
    seed()
    api({ 'POST /board/moves': status(403, { error: { code: 'X', message: 'Clients can’t finish tasks' } }) })
    await render(KanbanBoard, { user: me })
    drag(card('a'), 'dragstart')
    await nextTick()
    drag(columns()[2], 'dragover')
    await nextTick()
    drag(columns()[2], 'dragleave', { related: document.body })
    await nextTick()
    expect(columns()[2].querySelector('li[aria-hidden="true"]')).toBeNull()
    await dropCard('a', 2)
    expect(useToasts().toasts.at(-1)?.message).toBe('Clients can’t finish tasks')
    expect(titles(0)).toEqual(['Alpha', 'Beta'])
  })

  it('moves a column by dragging its header, showing where it lands', async () => {
    seed()
    const server = api({ 'PUT /board/columns': {} })
    await render(KanbanBoard, { user: me })
    columns().forEach((c, i) => place(c, { left: i * 300, width: 280 }))
    const header = columns()[0].querySelector('header')!
    drag(header, 'dragstart')
    await nextTick()
    drag(columns()[2], 'dragover', { x: 900 })
    await nextTick()
    expect($$('div.border-dashed[aria-hidden="true"]')).toHaveLength(1)
    drag(columns()[2], 'drop', { x: 900 })
    await flushPromises()
    expect(server.to('PUT /board/columns')[0].body).toEqual({ ids: ['doing', 'done', 'todo'] })
  })

  it('doesn’t let whoever doesn’t manage the board move a column', async () => {
    seed(false)
    await render(KanbanBoard, { user: me })
    const e = drag(columns()[0].querySelector('header')!, 'dragstart')
    expect(e.defaultPrevented).toBe(true)
  })

  it('renames a column in place, putting the old name back when refused', async () => {
    seed()
    const server = api({ 'PUT /board/columns/doing': status(422, { error: { code: 'V', message: 'Taken' } }) })
    await render(KanbanBoard, { user: me })
    await click(columns()[1].querySelector('h3')!)
    await type(columns()[1].querySelector('input')!, 'QA')
    columns()[1].querySelector('input')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }))
    await flushPromises()
    expect(server.to('PUT /board/columns/doing')[0].body).toEqual({ name: 'QA' })
    expect(columns()[1].querySelector('h3')?.textContent?.trim()).toBe('Review')
    expect(useToasts().toasts.at(-1)?.message).toBe('Taken')
  })

  it('moves a column from its menu, and says when that fails', async () => {
    seed()
    const server = api({ 'PUT /board/columns': status(500) })
    await render(KanbanBoard, { user: me })
    await click(columns()[0].querySelector('button[aria-haspopup="menu"]')!)
    await click(byText('[role="menuitem"]', t('board.moveRight')))
    expect(server.to('PUT /board/columns')[0].body).toEqual({ ids: ['doing', 'todo', 'done'] })
    expect(useToasts().toasts.at(-1)?.message).toBe(t('board.moveColumnFailed'))
  })

  it('deletes a column after saying what happens to its tasks', async () => {
    seed()
    const server = api({ 'GET /board': { can_manage: true, columns: [] } })
    await render(KanbanBoard, { user: me })
    await click(columns()[0].querySelector('button[aria-haspopup="menu"]')!)
    await click(byText('[role="menuitem"]', t('board.delete')))
    expect($('[role="dialog"]')?.textContent).toContain(t('board.tasksMove', { n: 2, status: t('columnForm.todo') }, 2))
    await click($$('[role="dialog"] button').find((b) => b.textContent?.trim() === t('common.delete'))!)
    expect(server.to('DELETE /board/columns/todo')).toHaveLength(1)

    seed()
    await flushPromises()
    await click(columns()[2].querySelector('button[aria-haspopup="menu"]')!)
    await click(byText('[role="menuitem"]', t('board.delete')))
    expect($('[role="dialog"]')?.textContent).toContain(t('board.emptyColumn'))
  })

  it('adds and edits columns in a form', async () => {
    seed()
    const server = api({ 'GET /board': { can_manage: true, columns: [] } })
    await render(KanbanBoard, { user: me })
    await click(button(t('board.addColumn')))
    await click($$('[role="dialog"] button').find((b) => b.textContent?.trim() === t('columnForm.add'))!)
    expect(server.to('POST /board/columns')).toHaveLength(0)
    await type(field(t('columnForm.name')), 'QA')
    await click($$('[role="dialog"] button').find((b) => b.textContent?.trim() === t('columnForm.add'))!)
    expect(server.to('POST /board/columns')[0].body).toMatchObject({ name: 'QA', status_category: 'in_progress' })
    expect($('[role="dialog"]')).toBeNull()

    seed()
    await flushPromises()
    await click(columns()[1].querySelector('button[aria-haspopup="menu"]')!)
    await click(byText('[role="menuitem"]', t('board.edit')))
    expect(field(t('columnForm.name')).value).toBe('Review')
    await click($$('[role="dialog"] button').find((b) => b.textContent?.trim() === t('common.save'))!)
    expect(server.to('PUT /board/columns/doing')[0].body).toEqual({ name: 'Review', status_category: 'in_progress' })
    await click(button(t('board.addColumn')))
    await click($$('[role="dialog"] button').find((b) => b.textContent?.trim() === t('common.cancel'))!)
    expect($('[role="dialog"]')).toBeNull()
  })

  it('asks for a new task in a column, never on the merged board', async () => {
    seed()
    const view = await render(KanbanBoard, { user: me })
    await click($$('button').filter((b) => b.textContent?.includes(t('board.addTask')))[1])
    expect((view.emitted('new-task')?.[0][0] as { id: string }).id).toBe('doing')
    useBoardStore().merged = true
    await nextTick()
    expect($$('button').filter((b) => b.textContent?.includes(t('board.addTask')))).toHaveLength(0)
  })

  it('lets a card move on the merged board only to a bucket its task may take', async () => {
    const board = seed(false)
    board.merged = true
    board.columns[0].tasks[0] = makeTask({ id: 'a', title: 'Alpha', next_statuses: ['in_progress'] }) as Task
    await render(KanbanBoard, { user: me })
    drag(card('a'), 'dragstart')
    await nextTick()
    expect(drag(columns()[1], 'dragover').defaultPrevented).toBe(true)
    expect(drag(columns()[2], 'dragover').defaultPrevented).toBe(false)
  })

  it('deletes a task from its card after asking, and says when it can’t', async () => {
    seed()
    const server = api({ 'DELETE /tasks/a': {} })
    await render(KanbanBoard, { user: me })
    const confirm = () => click($$('[role="dialog"] button').find((b) => b.textContent?.trim() === t('common.delete'))!)
    await click(button(t('board.deleteTaskNamed', { title: 'Alpha' })))
    expect($('[role="dialog"]')!.textContent).toContain(t('task.confirmDelete'))
    await confirm()
    expect(server.to('DELETE /tasks/a')).toHaveLength(1)
    expect(titles(0)).toEqual(['Beta'])
    expect(useToasts().toasts.at(-1)?.message).toBe(t('task.deleted'))

    server.reply('DELETE /tasks/b', status(409, { error: { code: 'X', message: 'Work on it has started' } }))
    await click(button(t('board.deleteTaskNamed', { title: 'Beta' })))
    await confirm()
    expect(titles(0)).toEqual(['Beta'])
    expect(useToasts().toasts.at(-1)?.message).toBe('Work on it has started')
    expect($('[role="dialog"]')).toBeNull()
  })

  it('edits a task from its card and shows it saved', async () => {
    seed()
    api({ 'GET /projects': { projects: [] }, 'PUT /tasks/a': { task: makeTask({ id: 'a', title: 'Alpha 2', status_id: 'todo' }) } })
    await render(KanbanBoard, { user: me })
    await click(button(t('board.editTaskNamed', { title: 'Alpha' })))
    await click($$('[role="dialog"] button').find((b) => b.textContent?.trim() === t('common.save'))!)
    expect(titles(0)).toEqual(['Alpha 2', 'Beta'])
  })
})
