import { describe, expect, it, vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import ProjectsView from '@/views/ProjectsView.vue'
import ProjectDetailView from '@/views/ProjectDetailView.vue'
import ProjectSettingsView from '@/views/ProjectSettingsView.vue'
import { t } from '@/i18n'
import { useToasts } from '@/composables/useToasts'
import type { Project, ProjectPerson } from '@/types/projects'
import { api, render, status, type Reply } from '../../helpers'
import { $, $$, button, choose, click, field, press, type } from '../../dom'
import { makeColumn, makeLink, makeProject, makeTask, makeUser } from '../../fixtures'

const me = makeUser({ hourly_rate_cents: 4000 })
const person = (id: string, role: ProjectPerson['role']): ProjectPerson => ({ id, name: `Person ${id}`, email: `${id}@x`, role })

describe('ProjectsView', () => {
  const list = [makeProject({ id: 'a', name: 'Landing', description: 'Marketing site', open_tasks: 2, total_tasks: 5 }), makeProject({ id: 'b', name: 'Shop', client: null })]

  function serve(extra: Record<string, Reply> = {}) {
    return api({ 'GET /projects': { projects: list }, 'GET /clients': { clients: [makeLink()] }, 'GET /invitations': { invitations: [] }, ...extra })
  }

  it('shows the projects as cards or a list, and finds them by name or description', async () => {
    serve()
    const page = await render(ProjectsView, { path: '/projects', user: me })
    expect(page.text()).toContain('Landing')
    expect(page.text()).toContain('Shop')
    await type($(`input[aria-label="${t('projects.search')}"]`) as HTMLInputElement, 'marketing')
    expect(page.text()).not.toContain('Shop')
    await type($(`input[aria-label="${t('projects.search')}"]`) as HTMLInputElement, 'zzz')
    expect(page.text()).toContain(t('projects.noMatch', { query: 'zzz' }))
    await type($(`input[aria-label="${t('projects.search')}"]`) as HTMLInputElement, '')
    await click(button(t('ui.views.list')))
    expect(page.router.currentRoute.value.query.view).toBe('list')
    expect(page.find('a[href="/projects/a"]').exists()).toBe(true)
  })

  it('creates a project for a client, or a personal one, and opens it', async () => {
    const server = serve({ 'POST /projects': (c: { body: Project }) => ({ project: makeProject({ id: 'new', name: c.body.name }) }) })
    const page = await render(ProjectsView, { path: '/projects', user: me })
    await click(button(t('projects.new')))
    await click(button(t('projectForm.create')))
    expect(server.to('POST /projects')).toHaveLength(0)
    await type(field(t('projectForm.name')), 'Brand')
    await choose(t('projectForm.client'), 'Acme')
    await click(button(t('projectForm.create')))
    expect(server.to('POST /projects')[0].body).toEqual({ name: 'Brand', description: '', client_id: 'u-client' })
    await vi.waitFor(() => expect(page.router.currentRoute.value.path).toBe('/projects/new'))
  })

  it('has a client start a project with their freelancers, telling them when they have none', async () => {
    const server = api({
      'GET /projects': { projects: [] },
      'GET /freelancers': { freelancers: [makeLink({ id: 'f1', name: 'Fay' }), makeLink({ id: 'f2', name: 'Gil' })] },
      'POST /projects': { project: makeProject({ id: 'new', name: 'Brand' }) },
    })
    await render(ProjectsView, { path: '/projects', user: makeUser({ role: 'client' }) })
    expect(document.body.textContent).toContain(t('projects.noneYetClient'))
    await click(button(t('projects.new')))
    await type(field(t('projectForm.name')), 'Brand')
    await click(button(t('projectForm.create')))
    expect(document.body.textContent).toContain(t('validation.chooseFreelancer'))
    await click(field(t('projectForm.freelancer')))
    await click($$('[role="checkbox"]')[1])
    await click(button(t('projectForm.create')))
    expect(server.to('POST /projects')[0].body).toMatchObject({ freelancer_ids: ['f2'] })

    document.body.innerHTML = ''
    api({ 'GET /projects': { projects: [] }, 'GET /freelancers': { freelancers: [] } })
    await render(ProjectsView, { path: '/projects', user: makeUser({ role: 'client' }) })
    await click(button(t('projects.new')))
    expect(document.body.textContent).toContain(t('projectForm.nobody'))
  })

  it('deletes a project after asking, saying when that fails', async () => {
    const server = serve()
    const page = await render(ProjectsView, { path: '/projects', user: me })
    await click(button(t('projects.deleteNamed', { name: 'Shop' })))
    await click($$('[role="dialog"] button').find((b) => b.textContent?.trim() === t('common.delete'))!)
    expect(server.to('DELETE /projects/b')).toHaveLength(1)
    expect(page.text()).not.toContain('Shop')

    server.reply('DELETE /projects/a', status(409, { error: { code: 'X', message: 'Has tasks' } }))
    await click(button(t('projects.deleteNamed', { name: 'Landing' })))
    await click($$('[role="dialog"] button').find((b) => b.textContent?.trim() === t('common.delete'))!)
    expect(useToasts().toasts.at(-1)?.message).toBe('Has tasks')
  })

  it('says when the projects can’t load', async () => {
    api({ 'GET /projects': status(500) })
    await render(ProjectsView, { path: '/projects', user: me })
    expect(useToasts().toasts.at(-1)?.message).toBe(t('projects.loadFailed'))
  })
})

describe('ProjectDetailView', () => {
  const project = makeProject({ id: 'p-1', name: 'Landing', description: 'Marketing site' })

  function serve(extra: Record<string, Reply> = {}) {
    return api({
      'GET /projects/p-1': { project },
      'GET /projects': { projects: [project] },
      'GET /projects/p-1/people': { participants: [person('u-freelancer', 'freelancer')], candidates: [] },
      'GET /tasks': { tasks: [makeTask({ id: 'a', title: 'Alpha', project: { id: 'p-1', name: 'Landing' } })] },
      'GET /board/columns': { can_manage: true, columns: [makeColumn()] },
      'GET /board': { can_manage: true, columns: [{ ...makeColumn(), tasks: [makeTask({ id: 'a', title: 'Alpha' })] }] },
      ...extra,
    })
  }

  it('shows the project, its people and tasks, and switches to its board', async () => {
    const server = serve()
    const page = await render(ProjectDetailView, { path: '/projects/p-1', user: me })
    expect(page.text()).toContain('Landing')
    expect(page.text()).toContain('Marketing site')
    expect(page.text()).toContain('Alpha')
    expect(server.to('GET /tasks')[0].params).toMatchObject({ project: 'p-1' })
    await click(button(t('ui.views.board')))
    expect(server.to('GET /board')[0].params).toMatchObject({ project: 'p-1' })
  })

  it('sets the freelancer’s own rate here, reloading the tasks', async () => {
    const server = serve({ 'PUT /projects/p-1/rate': { project: { ...project, my_hourly_rate_cents: 5000 } } })
    const page = await render(ProjectDetailView, { path: '/projects/p-1', user: me })
    expect(page.text()).toContain('$40/h')
    await click(button(t('timelog.projectRate')))
    const rate = $(`input[aria-label="${t('timelog.projectRate')}"]`) as HTMLInputElement
    await type(rate, '50')
    await press('Enter', rate)
    await flushPromises()
    expect(server.to('PUT /projects/p-1/rate')[0].body).toEqual({ rate: '50' })
    expect(page.text()).toContain('$50/h')
    expect(server.to('GET /tasks')).toHaveLength(2)
  })

  it('shows a refused rate under its field', async () => {
    serve({ 'PUT /projects/p-1/rate': status(422, { error: { code: 'V', message: 'x', fields: { rate: 'Too high' } } }) })
    await render(ProjectDetailView, { path: '/projects/p-1', user: me })
    await click(button(t('timelog.projectRate')))
    const rate = $(`input[aria-label="${t('timelog.projectRate')}"]`) as HTMLInputElement
    await type(rate, '9999999')
    await press('Enter', rate)
    await flushPromises()
    expect($('[role="dialog"]')?.textContent).toContain('Too high')
  })

  it('adds a task in the project and opens it', async () => {
    const server = serve({ 'POST /tasks': { task: makeTask({ id: 'new' }) } })
    const page = await render(ProjectDetailView, { path: '/projects/p-1', user: me })
    await click(button(t('tasks.newTask')))
    await type(field(t('task.titleLabel')), 'In the project')
    await click(button(t('taskForm.create')))
    expect(server.to('POST /tasks')[0].body).toMatchObject({ project_id: 'p-1' })
    await vi.waitFor(() => expect(page.router.currentRoute.value.path).toBe('/tasks/new'))
  })

  it('says a project that isn’t there can’t be found, or that it couldn’t load', async () => {
    api({ 'GET /projects/p-1': status(404) })
    const page = await render(ProjectDetailView, { path: '/projects/p-1', user: me })
    expect(page.text()).toContain(t('project.notFound'))

    document.body.innerHTML = ''
    api({ 'GET /projects/p-1': status(500) })
    await render(ProjectDetailView, { path: '/projects/p-1', user: me })
    expect(useToasts().toasts.at(-1)?.message).toBe(t('project.loadFailed'))
  })

  it('says when there are no tasks, or they can’t load', async () => {
    serve({ 'GET /tasks': { tasks: [] } })
    const page = await render(ProjectDetailView, { path: '/projects/p-1', user: me })
    expect(page.text()).toContain(t('project.noTasksTitle'))

    document.body.innerHTML = ''
    serve({ 'GET /tasks': status(500) })
    await render(ProjectDetailView, { path: '/projects/p-1', user: me })
    expect(useToasts().toasts.at(-1)?.message).toBe(t('project.tasksLoadFailed'))
  })
})

describe('ProjectSettingsView', () => {
  const project = makeProject({ id: 'p-1', name: 'Landing' })

  function serve(extra: Record<string, Reply> = {}) {
    return api({
      'GET /projects/p-1': { project },
      'PUT /projects/p-1': (c: { body: Project }) => ({ project: { ...project, ...c.body } }),
      'GET /projects/p-1/people': { participants: [person('u-freelancer', 'freelancer'), person('m', 'member')], candidates: [person('c', 'contractor'), person('d', 'owner')] },
      ...extra,
    })
  }

  it('renames the project', async () => {
    const server = serve()
    const page = await render(ProjectSettingsView, { path: '/projects/p-1/settings', user: me })
    await type(field(t('projectForm.name')), 'Landing v2')
    await click(button(t('common.save')))
    expect(server.to('PUT /projects/p-1')[0].body).toEqual({ name: 'Landing v2', description: '' })
    expect(useToasts().toasts.at(-1)?.message).toBe(t('project.saved'))
    expect(page.text()).toContain('Landing v2')
  })

  it('invites people to the project and removes one, on its own tab', async () => {
    const server = serve({
      'POST /projects/p-1/participants': { participants: [person('u-freelancer', 'freelancer'), person('m', 'member'), person('c', 'contractor')], candidates: [person('d', 'owner')] },
      'DELETE /projects/p-1/participants/m': { participants: [person('u-freelancer', 'freelancer')], candidates: [person('m', 'member'), person('d', 'owner')] },
    })
    const page = await render(ProjectSettingsView, { path: '/projects/p-1/settings?tab=people', user: me })
    expect(page.text()).toContain('Person m')
    await click(field(t('project.person')))
    await click($$('[role="checkbox"]')[0])
    await click(button(t('project.invite')))
    expect(server.to('POST /projects/p-1/participants')[0].body).toEqual({ user_ids: ['c'] })
    expect(useToasts().toasts.at(-1)?.message).toBe(t('project.invited'))

    // the author stays; the others each have a Remove, in the list's order
    await click($$('button').filter((b) => b.textContent?.trim() === t('common.remove'))[0])
    await click($$('[role="dialog"] button').find((b) => b.textContent?.includes(t('common.remove')))!)
    expect(server.to('DELETE /projects/p-1/participants/m')).toHaveLength(1)
    expect(useToasts().toasts.at(-1)?.message).toBe(t('project.removed'))
  })

  it('says a personal project has nobody else to invite', async () => {
    serve({ 'GET /projects/p-1': { project: { ...project, client: null } }, 'GET /projects/p-1/people': { participants: [person('u-freelancer', 'freelancer')], candidates: [] } })
    const page = await render(ProjectSettingsView, { path: '/projects/p-1/settings?tab=people', user: me })
    expect(page.text()).toContain(t('project.personalPeople'))
  })

  it('deletes the project after asking, going back to the list', async () => {
    const server = serve()
    const page = await render(ProjectSettingsView, { path: '/projects/p-1/settings', user: me })
    await click(button(t('project.delete')))
    await click($$('[role="dialog"] button').find((b) => b.textContent?.trim() === t('common.delete'))!)
    expect(server.to('DELETE /projects/p-1')).toHaveLength(1)
    await vi.waitFor(() => expect(page.router.currentRoute.value.path).toBe('/projects'))
  })

  it('sends whoever can’t edit to the project, and says a missing one can’t be found', async () => {
    serve({ 'GET /projects/p-1': { project: { ...project, can_edit: false } } })
    const page = await render(ProjectSettingsView, { path: '/projects/p-1/settings', user: me })
    await vi.waitFor(() => expect(page.router.currentRoute.value.path).toBe('/projects/p-1'))

    document.body.innerHTML = ''
    api({ 'GET /projects/p-1': status(404) })
    const missing = await render(ProjectSettingsView, { path: '/projects/p-1/settings', user: me })
    expect(missing.text()).toContain(t('project.notFound'))
  })
})
