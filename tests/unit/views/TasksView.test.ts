import { describe, expect, it, vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import TasksView from '@/views/TasksView.vue'
import TaskDetailView from '@/views/TaskDetailView.vue'
import { t } from '@/i18n'
import { api, render, status, type Reply } from '../../helpers'
import { $$, button, choose, click, field, type } from '../../dom'
import { makeColumn, makeLink, makeProject, makeTask, makeUser } from '../../fixtures'

const COLUMNS = [makeColumn({ id: 'c-new', name: 'New', category: 'new' }), makeColumn({ id: 'c-done', name: 'Done', category: 'done' })]

function serve(extra: Record<string, Reply> = {}) {
  return api({
    'GET /projects': { projects: [makeProject({ id: 'p-1', name: 'Landing' }), makeProject({ id: 'p-2', name: 'Shop' })] },
    'GET /clients': { clients: [makeLink()] },
    'GET /invitations': { invitations: [] },
    'GET /freelancers': { freelancers: [makeLink({ id: 'u-freelancer', name: 'Olena' })] },
    'GET /tasks': { tasks: [makeTask({ id: 'a', title: 'Alpha', status_id: 'c-new' }), makeTask({ id: 'b', title: 'Beta', status_id: 'c-done', status: 'done' })] },
    'GET /board/columns': { can_manage: true, columns: COLUMNS },
    'GET /board': { can_manage: true, columns: [{ ...COLUMNS[0], tasks: [makeTask({ id: 'a', title: 'Alpha' })] }, COLUMNS[1]] },
    ...extra,
  })
}

describe('TasksView', () => {
  it('lists the first project’s tasks, filtered by status', async () => {
    const server = serve()
    const page = await render(TasksView, { path: '/tasks', user: makeUser() })
    expect(server.to('GET /tasks')[0].params).toMatchObject({ project: 'p-1' })
    expect(page.text()).toContain('Alpha')
    expect(page.text()).toContain('Beta')

    await click(field(t('tasks.statusAria')))
    await click($$('[role="checkbox"]').find((c) => c.textContent?.includes(t('status.done')))!)
    expect(page.text()).not.toContain('Alpha')
  })

  it('opens the bucket the dashboard links to, dropping it from the URL', async () => {
    serve()
    const page = await render(TasksView, { path: '/tasks?status=done&with=u-client', user: makeUser() })
    expect(page.text()).not.toContain('Alpha')
    expect(page.text()).toContain('Beta')
    await vi.waitFor(() => expect(page.router.currentRoute.value.query.status).toBeUndefined())
    expect(page.router.currentRoute.value.query.with).toBeUndefined()
  })

  it('switches to the board of the picked project', async () => {
    const server = serve()
    const page = await render(TasksView, { path: '/tasks', user: makeUser() })
    await click(button(t('ui.views.board')))
    await flushPromises()
    expect(server.to('GET /board')[0].params).toMatchObject({ project: 'p-1' })
    expect($$('section[data-column]')).toHaveLength(2)
    await choose(t('tasks.projects'), 'Shop')
    expect(server.to('GET /board').at(-1)?.params).toMatchObject({ project: 'p-2' })
    expect(page.router.currentRoute.value.query.view).toBe('board')
  })

  it('creates a task and opens it from the list, or adds it to the board', async () => {
    const server = serve({ 'POST /tasks': { task: makeTask({ id: 'new' }) } })
    const page = await render(TasksView, { path: '/tasks', user: makeUser() })
    await click(button(t('tasks.newTask')))
    await type(field(t('task.titleLabel')), 'New one')
    await click(button(t('taskForm.create')))
    expect(server.to('POST /tasks')).toHaveLength(1)
    await vi.waitFor(() => expect(page.router.currentRoute.value.path).toBe('/tasks/new'))
  })

  it('adds a task straight into a board column', async () => {
    const server = serve({ 'POST /tasks': { task: makeTask({ id: 'new' }) } })
    await render(TasksView, { path: '/tasks?view=board', user: makeUser() })
    await click($$('button').find((b) => b.textContent?.includes(t('board.addTask')))!)
    await type(field(t('task.titleLabel')), 'In the column')
    await click(button(t('taskForm.create')))
    expect(server.to('POST /tasks')[0].body).toMatchObject({ status_id: 'c-new' })
    expect(server.to('GET /board')).toHaveLength(2)
  })

  it('says when the tasks can’t load, and when a filter matches nothing', async () => {
    serve({ 'GET /tasks': status(500) })
    const page = await render(TasksView, { path: '/tasks', user: makeUser() })
    expect(page.text()).toContain(t('tasks.loadFailed'))

    document.body.innerHTML = ''
    serve({ 'GET /tasks': { tasks: [] } })
    const empty = await render(TasksView, { path: '/tasks', user: makeUser() })
    // a freelancer with clients but no tasks yet
    expect(empty.text()).toContain(t('tasks.noneYetFreelancer'))
  })

  it('suggests inviting a client to a freelancer without any', async () => {
    serve({ 'GET /tasks': { tasks: [] }, 'GET /clients': { clients: [] } })
    const page = await render(TasksView, { path: '/tasks', user: makeUser() })
    expect(page.text()).toContain(t('tasks.noneYetPersonal'))
    expect(page.find('a[href="/clients"]').exists()).toBe(true)
  })

  it('tells a client without freelancers how to get one', async () => {
    serve({ 'GET /freelancers': { freelancers: [] }, 'GET /tasks': { tasks: [] } })
    const page = await render(TasksView, { path: '/tasks', user: makeUser({ role: 'client' }) })
    expect(page.text()).toContain(t('tasks.noFreelancersTitle'))
    await click(button(t('ui.views.board')))
    expect(page.text()).toContain(t('tasks.noFreelancersBoard'))
  })
})

describe('TaskDetailView', () => {
  function serveTask(task = makeTask()) {
    return api({
      [`GET /tasks/${task.id}`]: { task },
      'GET /board/columns': { can_manage: false, columns: COLUMNS },
      'GET /attachments': { attachments: [], max_size_bytes: 1 },
      'GET /comments': { comments: [] },
      [`GET /tasks/${task.id}/people`]: { people: [] },
      [`GET /tasks/${task.id}/history`]: { events: [] },
      'GET /board/labels': { labels: [] },
      'GET /projects': { projects: [] },
    })
  }

  it('shows the task with breadcrumbs to its project, and goes back to it', async () => {
    serveTask(makeTask({ project: { id: 'p-1', name: 'Landing' } }))
    const page = await render(TaskDetailView, { path: '/tasks/t-1', user: makeUser() })
    expect(page.text()).toContain('Landing')
    expect(page.text()).toContain('Write the landing page')
    await click(button(t('taskPage.back')))
    await vi.waitFor(() => expect(page.router.currentRoute.value.path).toBe('/projects/p-1'))
  })

  it('goes back in history when there is somewhere to go, else to the list; and leaves once deleted', async () => {
    const server = serveTask()
    const page = await render(TaskDetailView, { path: '/tasks/t-1', user: makeUser() })
    const back = vi.spyOn(page.router, 'back').mockImplementation(() => {})
    window.history.replaceState({ back: '/tasks' }, '')
    await click(button(t('taskPage.back')))
    expect(back).toHaveBeenCalled()
    window.history.replaceState({}, '')
    await click(button(t('taskPage.back')))
    await vi.waitFor(() => expect(page.router.currentRoute.value.path).toBe('/tasks'))

    await page.router.push('/tasks/t-1')
    await flushPromises()
    await click(button(t('task.options')))
    await click(button(t('task.delete')))
    await click($$('[role="dialog"] button').find((b) => b.textContent?.trim() === t('common.delete'))!)
    expect(server.to('DELETE /tasks/t-1')).toHaveLength(1)
  })
})
