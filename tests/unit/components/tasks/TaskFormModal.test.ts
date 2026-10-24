import { describe, expect, it } from 'vitest'
import TaskFormModal from '@/components/tasks/TaskFormModal.vue'
import { t } from '@/i18n'
import { useProjectsStore } from '@/stores/projects'
import { api, render, status } from '../../../helpers'
import { $, $$, button, choose, click, field, texts, type } from '../../../dom'
import { makeLink, makeProject, makeTask, makeUser } from '../../../fixtures'

const freelancer = makeUser()
const client = makeUser({ id: 'u-client', role: 'client', name: 'Acme', email: 'acme@example.test' })

const acme = makeLink({ id: 'u-client', name: 'Acme' })
const globex = makeLink({ id: 'u-globex', name: 'Globex', email: 'g@example.test' })

function serve(projects = [makeProject({ id: 'p-acme', name: 'Acme site' }), makeProject({ id: 'p-own', name: 'My own', client: null })]) {
  return api({
    'GET /projects': { projects },
    'POST /tasks': (c) => ({ task: makeTask({ id: 'new', title: (c.body as { title: string }).title }) }),
  })
}

const save = () => button(t('taskForm.create'))

describe('TaskFormModal: a freelancer creating', () => {
  it('needs a title, then creates a personal task by default', async () => {
    const server = serve()
    const form = await render(TaskFormModal, { props: { people: [acme, globex] }, user: freelancer })
    await click(save())
    expect(server.to('POST /tasks')).toHaveLength(0)
    expect(document.body.textContent).toContain(t('validation.required.title'))

    await type(field(t('task.titleLabel')), 'Hero section')
    expect(document.body.textContent).toContain(t('taskForm.personalNote'))
    await click(save())
    expect(server.to('POST /tasks')[0].body).toEqual({ title: 'Hero section', description: '', due_on: null, priority: 'none' })
    expect(form.emitted('saved')?.[0][0]).toMatchObject({ id: 'new' })
  })

  it('creates a task for a client, in their project, with a price and priority', async () => {
    const server = serve()
    await render(TaskFormModal, { props: { people: [acme, globex] }, user: freelancer })
    await choose(t('taskForm.client'), 'Acme')
    expect(texts('[role="option"]')).toEqual([])
    await click(field(t('taskForm.project')))
    expect(texts('[role="option"]')).toEqual(['No project', 'Acme site'])
    await click($$('[role="option"]')[1])
    await type(field(t('task.titleLabel')), 'Hero')
    await type(field(t('taskForm.price', { currency: 'USD' })), '1 200')
    await choose(t('taskForm.priority'), t('priority.high'))
    await click(save())
    expect(server.to('POST /tasks')[0].body).toMatchObject({ title: 'Hero', project_id: 'p-acme', price: '1 200', priority: 'high' })
  })

  it('drops a project the newly picked client isn’t on', async () => {
    const server = serve()
    await render(TaskFormModal, { props: { people: [acme, globex] }, user: freelancer })
    await choose(t('taskForm.client'), 'Acme')
    await choose(t('taskForm.project'), 'Acme site')
    await choose(t('taskForm.client'), 'Globex')
    await type(field(t('task.titleLabel')), 'X')
    await click(save())
    expect(server.to('POST /tasks')[0].body).toMatchObject({ client_id: 'u-globex' })
    expect(server.to('POST /tasks')[0].body).not.toHaveProperty('project_id')
  })

  it('refuses a malformed price, and puts the API’s complaint on its field', async () => {
    const server = serve()
    server.reply('POST /tasks', status(422, { error: { code: 'V', message: 'Bad', fields: { client_id: 'Not your client' } } }))
    await render(TaskFormModal, { props: { people: [acme], personId: 'u-client' }, user: freelancer })
    await type(field(t('task.titleLabel')), 'X')
    await type(field(t('taskForm.price', { currency: 'USD' })), '1.999')
    await click(save())
    expect(server.to('POST /tasks')).toHaveLength(0)
    await type(field(t('taskForm.price', { currency: 'USD' })), '')
    await click(save())
    expect(document.body.textContent).toContain('Not your client')
  })

  it('creates straight into a board column, saying which', async () => {
    const server = serve()
    await render(TaskFormModal, { props: { statusId: 'c-review', columnName: 'Review' }, user: freelancer })
    expect($('[role="dialog"]')?.textContent).toContain(t('taskForm.newIn', { column: 'Review' }))
    await type(field(t('task.titleLabel')), 'X')
    await click(save())
    expect(server.to('POST /tasks')[0].body).toMatchObject({ status_id: 'c-review' })
  })

  it('names the project it creates in, and whom it is for', async () => {
    serve()
    useProjectsStore().projects = [makeProject({ id: 'p-acme', name: 'Acme site' })]
    useProjectsStore().loaded = true
    await render(TaskFormModal, { props: { projectId: 'p-acme' }, user: freelancer })
    expect(document.body.textContent).toContain(t('taskForm.for', { name: 'Acme' }))
  })
})

describe('TaskFormModal: a client creating', () => {
  const project = makeProject({
    id: 'p-shared',
    name: 'Shared',
    participants: [
      { id: 'f1', name: 'Fay', email: 'f1@x', role: 'freelancer' },
      { id: 'f2', name: 'Gil', email: 'f2@x', role: 'freelancer' },
    ],
  })

  it('must pick a freelancer, or keep the task for themselves', async () => {
    const server = serve([project])
    await render(TaskFormModal, { props: { people: [makeLink({ id: 'f1', name: 'Fay' }), makeLink({ id: 'f2', name: 'Gil' })] }, user: client })
    await type(field(t('task.titleLabel')), 'Logo')
    await click(save())
    expect(document.body.textContent).toContain(t('validation.chooseFreelancer'))
    await choose(t('taskForm.forWhom'), t('taskForm.personalOptionClient'))
    await click(save())
    expect(server.to('POST /tasks')[0].body).toMatchObject({ personal: true })
    expect(document.body.textContent).not.toContain(t('taskForm.price', { currency: 'USD' }))
  })

  it('asks which freelancer in a project with several, and names the only one', async () => {
    const server = serve([project])
    await render(TaskFormModal, { props: { projectId: 'p-shared' }, user: client })
    await choose(t('taskForm.freelancer'), 'Gil')
    await type(field(t('task.titleLabel')), 'Logo')
    await click(save())
    expect(server.to('POST /tasks')[0].body).toMatchObject({ project_id: 'p-shared', freelancer_id: 'f2' })

    document.body.innerHTML = ''
    useProjectsStore().$reset()
    serve([{ ...project, participants: [project.participants[0]] }])
    await render(TaskFormModal, { props: { projectId: 'p-shared' }, user: client })
    expect(document.body.textContent).toContain(t('taskForm.with', { name: 'Fay' }))
  })

  it('says a project without a freelancer has nobody to do the task', async () => {
    serve([{ ...project, participants: [] }])
    await render(TaskFormModal, { props: { projectId: 'p-shared' }, user: client })
    expect(document.body.textContent).toContain(t('taskForm.noFreelancer'))
  })
})

describe('TaskFormModal: editing', () => {
  it('saves the content, and the price and priority on their own endpoints when they changed', async () => {
    const task = makeTask({ title: 'Old', price_cents: 1000, priority: 'low' })
    const server = api({
      'GET /projects': { projects: [] },
      'PUT /tasks/t-1': { task },
      'PUT /tasks/t-1/price': { task },
      'PUT /tasks/t-1/priority': { task: { ...task, priority: 'high' } },
    })
    const form = await render(TaskFormModal, { props: { task }, user: freelancer })
    expect($('[role="dialog"]')?.textContent).toContain(t('taskForm.edit'))
    expect(field(t('taskForm.price', { currency: 'USD' })).value).toBe('10')
    await type(field(t('task.titleLabel')), 'New')
    await click(button(t('common.save')))
    expect(server.to('PUT /tasks/t-1')[0].body).toMatchObject({ title: 'New', project_id: '' })
    expect(server.to('PUT /tasks/t-1/price')).toHaveLength(0)
    expect(server.to('PUT /tasks/t-1/priority')).toHaveLength(0)

    await type(field(t('taskForm.price', { currency: 'USD' })), '20')
    await choose(t('taskForm.priority'), t('priority.high'))
    await click(button(t('common.save')))
    expect(server.to('PUT /tasks/t-1/price')[0].body).toEqual({ billing: 'fixed', price: '20' })
    expect(server.to('PUT /tasks/t-1/priority')[0].body).toEqual({ priority: 'high' })
    expect(form.emitted('saved')?.at(-1)?.[0]).toMatchObject({ priority: 'high' })
  })

  it('closes from its cancel button', async () => {
    api({ 'GET /projects': { projects: [] } })
    const form = await render(TaskFormModal, { props: { task: makeTask() }, user: freelancer })
    await click(button(t('common.cancel')))
    expect(form.emitted('close')).toHaveLength(1)
  })
})
