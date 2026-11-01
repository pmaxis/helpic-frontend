import { describe, expect, it, vi } from 'vitest'
import BacklogView from '@/views/BacklogView.vue'
import { t } from '@/i18n'
import { useToasts } from '@/composables/useToasts'
import { api, render, status, type Reply } from '../../helpers'
import { $, $$, button, choose, click, field, type } from '../../dom'
import { makeLink, makeProject, makeTask, makeUser } from '../../fixtures'

const WAITING = [
  makeTask({ id: 'a', title: 'Alpha', in_backlog: true, project: { id: 'p-1', name: 'Landing' } }),
  makeTask({ id: 'b', title: 'Beta', in_backlog: true, can_edit: true }),
]

function serve(extra: Record<string, Reply> = {}) {
  return api({
    'GET /projects': { projects: [makeProject({ id: 'p-1', name: 'Landing' }), makeProject({ id: 'p-2', name: 'Shop' })] },
    'GET /clients': { clients: [makeLink()] },
    'GET /invitations': { invitations: [] },
    'GET /tasks': { tasks: WAITING },
    ...extra,
  })
}

describe('BacklogView', () => {
  it('lists every backlog, and one project’s from the address, filtering in it', async () => {
    const server = serve()
    let page = await render(BacklogView, { path: '/backlog', user: makeUser() })
    expect(server.to('GET /tasks')[0].params).toEqual({ backlog: 1 })
    expect(page.text()).toContain('Alpha')
    expect(page.text()).toContain('Beta')
    page.unmount()

    page = await render(BacklogView, { path: '/backlog?project=p-1', user: makeUser() })
    expect(server.to('GET /tasks').at(-1)?.params).toEqual({ backlog: 1, project: 'p-1' })
    await choose(t('tasks.projects'), 'Shop')
    expect(page.router.currentRoute.value.query.project).toBe('p-2')
    await vi.waitFor(() => expect(server.to('GET /tasks').at(-1)?.params).toEqual({ backlog: 1, project: 'p-2' }))
  })

  it('has a way back to the tasks, and no board or list tabs', async () => {
    serve()
    await render(BacklogView, { path: '/backlog?project=p-1', user: makeUser() })
    expect($('h1')!.textContent?.trim()).toBe(t('backlog.open'))
    expect($(`a[aria-label="${t('backlog.close')}"]`)!.getAttribute('href')).toBe('/tasks?project=p-1')
    // small crumbs with a quiet back arrow, as on a report or a project's settings
    const crumbs = $(`nav[aria-label="${t('backlog.breadcrumb')}"]`)!
    expect([...crumbs.querySelectorAll('a, span')].map((e) => e.textContent?.trim()).filter(Boolean)).toEqual([t('tasks.title'), t('backlog.open')])
    expect([...crumbs.querySelectorAll('a')].find((a) => a.textContent?.trim() === t('tasks.title'))!.getAttribute('href')).toBe('/tasks?project=p-1')
    expect($('[data-view]')).toBeNull()
    expect($('[data-backlog-button]')).toBeNull()
  })

  it('puts a task back on the board from its row, and it leaves the list', async () => {
    serve({ 'PUT /tasks/b/backlog': { task: { ...WAITING[1], in_backlog: false } } })
    const page = await render(BacklogView, { path: '/backlog', user: makeUser() })
    const row = $$('li').find((li) => li.textContent?.includes('Beta'))!
    await click(row.querySelector('button')!)
    await click(button(t('backlog.toBoard')))
    expect(page.text()).not.toContain('Beta')
    expect(page.text()).toContain('Alpha')
    expect(useToasts().toasts.at(-1)?.message).toBe(t('backlog.movedToBoard'))
  })

  it('adds a new task straight into the backlog of the project in view', async () => {
    const server = serve({ 'POST /tasks': { task: makeTask({ id: 'new', in_backlog: true }) } })
    await render(BacklogView, { path: '/backlog?project=p-1', user: makeUser() })
    await click(button(t('tasks.newTask')))
    expect($('[role="dialog"]')?.textContent).toContain(t('taskForm.newInBacklog'))
    await type(field(t('task.titleLabel')), 'Later')
    await click(button(t('taskForm.create')))
    expect(server.to('POST /tasks')[0].body).toMatchObject({ title: 'Later', backlog: true, project_id: 'p-1' })
    expect(server.to('GET /tasks')).toHaveLength(2)
  })

  it('says when the backlog is empty, or the project has nothing in it, or it can’t load', async () => {
    serve({ 'GET /tasks': { tasks: [] } })
    let page = await render(BacklogView, { path: '/backlog', user: makeUser() })
    expect(page.text()).toContain(t('backlog.empty'))
    page.unmount()

    page = await render(BacklogView, { path: '/backlog?project=p-1', user: makeUser() })
    expect(page.text()).toContain(t('backlog.nothingMatches'))
    await click(button(t('backlog.showAll')))
    expect(page.router.currentRoute.value.query.project).toBeUndefined()
    page.unmount()

    serve({ 'GET /tasks': status(500) })
    page = await render(BacklogView, { path: '/backlog', user: makeUser() })
    expect(page.text()).toContain(t('backlog.loadFailed'))
  })
})
