import { afterEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import TaskList from '@/components/tasks/TaskList.vue'
import AvatarStack from '@/components/tasks/AvatarStack.vue'
import PriorityIcon from '@/components/tasks/PriorityIcon.vue'
import StatusBadge from '@/components/tasks/StatusBadge.vue'
import LabelChip from '@/components/tasks/LabelChip.vue'
import { t } from '@/i18n'
import { api, render } from '../../../helpers'
import { button, click } from '../../../dom'
import { makeTask, makeUser } from '../../../fixtures'

afterEach(() => {
  vi.useRealTimers()
})

describe('TaskList', () => {
  it('lists each task with its summary, project, people and due date, overdue in red', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(2030, 0, 20))
    const tasks = [
      makeTask({ id: 'a', title: 'Hero', description: '\nFirst line\nSecond', project: { id: 'p', name: 'Landing' }, due_on: '2030-01-10' }),
      makeTask({ id: 'b', title: 'Footer', status: 'done', due_on: '2030-01-10', can_edit: false }),
    ]
    const list = await render(TaskList, { props: { tasks }, user: makeUser() })
    expect(list.text()).toContain('First line')
    expect(list.text()).not.toContain('Second')
    expect(list.text()).toContain('Landing')
    expect(list.findAll('[aria-label="Overdue"]')).toHaveLength(1)
    expect(list.findAll('a[href="/tasks/a"]').length).toBeGreaterThan(0)

    const noProject = await render(TaskList, { props: { tasks, hideProject: true }, user: makeUser() })
    expect(noProject.text()).not.toContain('Landing')
  })

  it('edits a task from its row', async () => {
    const server = api({ 'GET /projects': { projects: [] }, 'PUT /tasks/a': { task: makeTask({ id: 'a', title: 'Renamed' }) } })
    const list = await render(TaskList, { props: { tasks: [makeTask({ id: 'a', title: 'Hero' })] }, user: makeUser() })
    await click(button(t('taskList.editNamed', { title: 'Hero' })))
    await click(button(t('common.save')))
    expect(server.to('PUT /tasks/a')).toHaveLength(1)
    expect(list.emitted('saved')?.[0][0]).toMatchObject({ title: 'Renamed' })
  })

  it('dims while loading', async () => {
    const list = await render(TaskList, { props: { tasks: [], loading: true } })
    expect(list.classes()).toContain('opacity-60')
  })
})

describe('the small task pieces', () => {
  it('stacks up to three people, folding the rest into +N, you as “You”', async () => {
    const me = makeUser()
    const people = [me, { id: 'b', name: 'Bo Li', email: 'b@x' }, { id: 'c', name: '', email: 'cy@x' }, { id: 'd', name: 'D', email: 'd@x' }]
    const stack = await render(AvatarStack, { props: { people }, user: me })
    expect(stack.text()).toContain('BL')
    expect(stack.text()).toContain('CY')
    expect(stack.text()).toContain('+1')
    expect(stack.attributes('aria-label')).toContain(t('common.you_capital'))
  })

  it('shows a priority icon, nothing for none unless asked', () => {
    expect(mount(PriorityIcon, { props: { priority: 'urgent' } }).find('svg').exists()).toBe(true)
    expect(mount(PriorityIcon, { props: { priority: 'none' } }).find('svg').exists()).toBe(false)
    expect(mount(PriorityIcon, { props: { priority: 'none', showNone: true } }).html()).not.toBe('<!--v-if-->')
  })

  it('names a status by its column, or by its bucket', () => {
    expect(mount(StatusBadge, { props: { status: 'done', name: 'Shipped' } }).text()).toBe('Shipped')
    expect(mount(StatusBadge, { props: { status: 'done' } }).text()).toBe(t('status.done'))
  })

  it('colours a label, grey for an unknown colour', () => {
    expect(mount(LabelChip, { props: { name: 'Bug', color: 'red' } }).classes().join(' ')).toContain('red')
    expect(mount(LabelChip, { props: { name: 'Bug', color: 'plaid', size: 'xs' } }).classes().join(' ')).toContain('neutral')
  })
})
