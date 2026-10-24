import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import DashboardView from '@/views/DashboardView.vue'
import { t } from '@/i18n'
import { useToasts } from '@/composables/useToasts'
import type { Report } from '@/types/reports'
import { api, render, status, type Reply } from '../../helpers'
import { $, button, click, field, type } from '../../dom'
import { makeLink, makeProject, makeReport, makeTask, makeUser } from '../../fixtures'

/** 15 March 2030, mid-afternoon. */
const NOW = new Date(2030, 2, 15, 15)

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(NOW)
})

afterEach(() => {
  vi.useRealTimers()
})

const paid = (id: string, month: string, cents: number, client = 'u-client'): Report =>
  makeReport({ id, status: 'paid', paid_at: `2030-${month}-10T09:00:00Z`, total_cents: cents, client: { id: client, name: client, email: `${client}@x` } })

function serve(over: Record<string, Reply> = {}) {
  return api({
    'GET /tasks': {
      tasks: [
        makeTask({ id: 'a', title: 'Today’s urgent', due_on: '2030-03-15', priority: 'urgent' }),
        makeTask({ id: 'b', title: 'Today’s low', due_on: '2030-03-15', priority: 'low', project: { id: 'p-1', name: 'Landing' } }),
        makeTask({ id: 'c', title: 'Late', due_on: '2030-03-01', status: 'in_progress' }),
        makeTask({ id: 'd', title: 'Done', status: 'done', updated_at: '2030-03-14T00:00:00Z' }),
        makeTask({ id: 'e', title: 'Mine', client: null, due_on: '2030-03-15' }),
      ],
    },
    'GET /projects': { projects: [makeProject({ id: 'p-1', name: 'Landing', open_tasks: 1, total_tasks: 4 }), makeProject({ id: 'p-2', name: 'Empty' })] },
    'GET /reports': {
      reports: [
        paid('r1', '03', 30000),
        paid('r2', '02', 20000),
        paid('r3', '02', 5000, 'u-globex'),
        makeReport({ id: 'r4', status: 'sent', total_cents: 9900, title: 'Sent one' }),
        makeReport({ id: 'r5', client: null, title: 'Personal one' }),
      ],
    },
    'GET /clients': { clients: [makeLink(), makeLink({ id: 'u-globex', name: 'Globex' })] },
    'GET /invitations': { invitations: [] },
    'GET /freelancers': { freelancers: [makeLink({ id: 'u-freelancer', name: 'Olena' })] },
    ...over,
  })
}

describe('DashboardView, for a freelancer', () => {
  it('greets by the time of day and sums up the tasks', async () => {
    serve()
    const page = await render(DashboardView, { path: '/dashboard', user: makeUser() })
    expect(page.text()).toContain(t('dashboard.greetingNamed', { part: t('dashboard.greeting.afternoon'), name: 'Olena' }))
    expect(page.text()).toContain(t('dashboard.openTasks', { n: 4 }, 4))
    expect(page.text()).toContain(t('dashboard.overdueCount', { n: 1 }))
    expect(page.text()).toContain(t('dashboard.dueToday', { n: 3 }))
  })

  it('leads with this month’s earnings against the last, and what’s still to come', async () => {
    serve()
    const page = await render(DashboardView, { path: '/dashboard', user: makeUser() })
    expect(page.text()).toContain('$300')
    expect(page.text()).toContain('20%')
    expect(page.text()).toContain('$99')
    expect(page.text()).toContain(t('dashboard.stats.sentReports', { n: 1 }, 1))
    expect(page.text()).toContain('$550')
  })

  it('lists today’s tasks, most urgent first, and switches to the overview', async () => {
    serve()
    const page = await render(DashboardView, { path: '/dashboard', user: makeUser() })
    const text = page.text()
    expect(text.indexOf('Today’s urgent')).toBeLessThan(text.indexOf('Today’s low'))
    expect(text).toContain(t('dashboard.personal'))
    await click(button(t('dashboard.workload.views.overview')))
    expect(localStorage.getItem('helpic.dashboard.tasksView')).toBe('overview')
    expect(page.text()).toContain(t('status.in_progress'))
  })

  it('ranks the clients by what they brought, the busiest projects, and the latest reports', async () => {
    serve()
    const page = await render(DashboardView, { path: '/dashboard', user: makeUser() })
    expect(page.text().indexOf('u-client')).toBeLessThan(page.text().indexOf('Globex'))
    expect(page.text()).toContain('Landing')
    expect(page.text()).not.toContain('Empty')
    expect(page.text()).toContain(t('dashboard.closedOf', { closed: 3, total: 4 }))
    // the three newest reports
    expect(page.text()).toContain('$300.00')
    expect(page.text()).toContain(t('dashboard.reportStatus.paid'))
    expect(page.text()).not.toContain('Sent one')
  })

  it('creates a task and opens it', async () => {
    const server = serve({ 'POST /tasks': { task: makeTask({ id: 'new' }) } })
    const page = await render(DashboardView, { path: '/dashboard', user: makeUser() })
    await click(button(t('tasks.newTask')))
    await type(field(t('task.titleLabel')), 'From the dashboard')
    await click(button(t('taskForm.create')))
    expect(server.to('POST /tasks')).toHaveLength(1)
    vi.useRealTimers()
    await vi.waitFor(() => expect(page.router.currentRoute.value.path).toBe('/tasks/new'))
  })

  it('says when it can’t load, and is quiet with nothing in it', async () => {
    serve({ 'GET /tasks': status(500) })
    await render(DashboardView, { path: '/dashboard', user: makeUser() })
    expect(useToasts().toasts.at(-1)?.message).toBe(t('dashboard.loadFailed'))

    document.body.innerHTML = ''
    serve({ 'GET /tasks': { tasks: [] }, 'GET /projects': { projects: [] }, 'GET /reports': { reports: [] }, 'GET /clients': { clients: [] } })
    const empty = await render(DashboardView, { path: '/dashboard', user: makeUser() })
    expect(empty.text()).toContain(t('dashboard.nothingOverdue'))
    expect(empty.text()).toContain(t('dashboard.noProjects'))
    expect(empty.text()).toContain(t('dashboard.noReports'))
    expect(empty.text()).toContain(t('dashboard.lead.none'))
    expect(empty.text()).toContain(t('dashboard.people.noClients'))
    expect(empty.text()).toContain(t('dashboard.workload.nothingToday'))
  })
})

describe('DashboardView, for the client’s side', () => {
  it('shows the owner what they paid, by freelancer', async () => {
    serve()
    const page = await render(DashboardView, { path: '/dashboard', user: makeUser({ id: 'u-client', role: 'client', name: 'Acme' }) })
    expect(page.text()).toContain(t('dashboard.lead.paid'))
    expect(page.text()).toContain(t('dashboard.stats.toPay'))
    expect(page.text()).toContain(t('dashboard.people.byPaid'))
    expect(page.text()).toContain('Olena')
  })

  it('shows a team member no money: tasks first, people by open tasks', async () => {
    const server = serve()
    const page = await render(DashboardView, {
      path: '/dashboard',
      user: makeUser({ id: 'm', role: 'client', member_of: { owner_id: 'u-client', name: 'Acme', role: 'member' } }),
    })
    expect(server.to('GET /reports')).toHaveLength(0)
    expect(page.text()).not.toContain(t('dashboard.lead.paid'))
    expect(page.text()).toContain(t('dashboard.people.byOpen'))
    expect($('#dash-reports')).toBeNull()
  })
})
