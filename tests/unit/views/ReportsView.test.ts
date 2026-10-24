import { afterEach, describe, expect, it, vi } from 'vitest'
import ReportsView from '@/views/ReportsView.vue'
import { t } from '@/i18n'
import { useToasts } from '@/composables/useToasts'
import { api, render, status } from '../../helpers'
import { $, $$, button, choose, click, field, type } from '../../dom'
import { makeLink, makeProject, makeReport, makeUser } from '../../fixtures'

afterEach(() => {
  vi.useRealTimers()
})

describe('ReportsView', () => {
  it('lists the reports with whom they are for, their period and status', async () => {
    api({
      'GET /reports': {
        reports: [
          makeReport({ id: 'a', title: 'January', status: 'paid', item_count: 3, total_cents: 5000 }),
          makeReport({ id: 'b', title: 'Mine', client: null, from: '2030-02-01', to: '2030-02-01' }),
        ],
      },
    })
    const page = await render(ReportsView, { path: '/reports', user: makeUser() })
    expect(page.text()).toContain('January')
    expect(page.text()).toContain('Acme')
    expect(page.text()).toContain('1 Feb 2030')
    expect(page.findAll('a[href="/reports/a"]').length).toBeGreaterThan(0)
  })

  it('names the freelancer to a client, and says when there are none or they can’t load', async () => {
    api({ 'GET /reports': { reports: [makeReport({ freelancer: { id: 'f', name: 'Fay', email: 'f@x' } })] } })
    const page = await render(ReportsView, { path: '/reports', user: makeUser({ role: 'client' }) })
    expect(page.text()).toContain('Fay')

    document.body.innerHTML = ''
    api({ 'GET /reports': { reports: [] } })
    const empty = await render(ReportsView, { path: '/reports', user: makeUser({ role: 'client' }) })
    expect(empty.text()).toContain(t('reports.noneYetClient'))

    api({ 'GET /reports': status(500) })
    await render(ReportsView, { path: '/reports', user: makeUser() })
    expect(useToasts().toasts.at(-1)?.message).toBe(t('reports.loadFailed'))
  })

  it('makes a new report for a client’s projects and opens it', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(2030, 1, 20))
    const server = api({
      'GET /reports': { reports: [] },
      'GET /clients': { clients: [makeLink(), makeLink({ id: 'g', name: 'Globex' })] },
      'GET /invitations': { invitations: [] },
      'GET /projects': { projects: [makeProject({ id: 'p-1', name: 'Landing' }), makeProject({ id: 'p-own', name: 'Mine', client: null })] },
      'POST /reports': { report: makeReport({ id: 'new' }) },
    })
    const page = await render(ReportsView, { path: '/reports', user: makeUser() })
    await click(button(t('reports.new')))
    expect(field(t('newReport.from')).textContent).toContain('1 Feb 2030')
    await choose(t('newReport.client'), 'Acme')
    await click(field(t('newReport.projects')))
    await click($$('[role="checkbox"]').find((c) => c.textContent?.includes('Landing'))!)
    await type(field(t('newReport.titleLabel')), 'February')
    await click(button(t('newReport.createDraft')))
    expect(server.to('POST /reports')[0].body).toEqual({ client_id: 'u-client', project_ids: ['p-1'], from: '2030-02-01', to: '2030-02-20', title: 'February', kind: 'basic' })
    await vi.waitFor(() => expect(page.router.currentRoute.value.path).toBe('/reports/new'))
  })

  it('makes a personal report, picking the only client by default, and refuses a backwards period', async () => {
    const server = api({
      'GET /reports': { reports: [] },
      'GET /clients': { clients: [makeLink()] },
      'GET /invitations': { invitations: [] },
      'GET /projects': { projects: [] },
    })
    await render(ReportsView, { path: '/reports', user: makeUser() })
    await click(button(t('reports.new')))
    expect(field(t('newReport.client')).textContent).toContain('Acme')
    await choose(t('newReport.client'), t('newReport.noClient'))
    expect(document.body.textContent).toContain(t('newReport.personal'))

    await click(field(t('newReport.from')))
    await click('[aria-label="Next month"]')
    await click($$('[role="gridcell"]')[20])
    await click(button(t('newReport.create')))
    expect(server.to('POST /reports')).toHaveLength(0)
    expect(document.body.textContent).toContain(t('validation.periodEndsBeforeStart'))
    await click($$('[role="dialog"] button').find((b) => b.textContent?.trim() === t('common.cancel'))!)
    expect($('[role="dialog"]')).toBeNull()
  })
})
