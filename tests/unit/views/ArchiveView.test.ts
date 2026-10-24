import { describe, expect, it, vi } from 'vitest'
import ArchiveView from '@/views/ArchiveView.vue'
import { t } from '@/i18n'
import { api, render, status } from '../../helpers'
import { $$, button, choose, click } from '../../dom'
import { makeLink, makeProject, makeTask, makeUser } from '../../fixtures'

const archived = (id: string, over = {}) =>
  makeTask({ id, title: `Task ${id}`, archived_at: '2030-02-01T00:00:00Z', status: 'done', ...over })

function serve(pages: Record<number, { tasks: unknown[]; total: number }> = { 1: { tasks: [archived('a', { archived_by: { id: 'r', title: 'January' } }), archived('b', { client: null })], total: 2 } }) {
  return api({
    'GET /archive': (c: { params: { page?: number } }) => ({ ...(pages[c.params.page ?? 1] ?? { tasks: [], total: 0 }), page: c.params.page ?? 1, limit: 10 }),
    'GET /clients': { clients: [makeLink()] },
    'GET /invitations': { invitations: [] },
    'GET /projects': { projects: [makeProject({ id: 'p-1', name: 'Landing' })] },
  })
}

describe('ArchiveView', () => {
  it('lists what was archived, saying why', async () => {
    serve()
    const page = await render(ArchiveView, { path: '/archive', user: makeUser() })
    expect(page.text()).toContain('Task a')
    expect(page.text()).toContain(t('archive.paidIn', { report: 'January' }))
    expect(page.text()).toContain(t('archive.byHand'))
    expect(page.text()).toContain(t('archive.personal'))
  })

  it('pages through the archive, the page in the address', async () => {
    const tasks = Array.from({ length: 10 }, (_, i) => archived(`p1-${i}`))
    const server = serve({ 1: { tasks, total: 12 }, 2: { tasks: [archived('last')], total: 12 } })
    const page = await render(ArchiveView, { path: '/archive', user: makeUser() })
    await click($$('button').find((b) => b.textContent?.trim() === '2')!)
    await vi.waitFor(() => expect(page.text()).toContain('Task last'))
    expect(page.router.currentRoute.value.query.page).toBe('2')
    expect(server.to('GET /archive').at(-1)?.params).toMatchObject({ page: 2 })
  })

  it('goes to the last page from a link past it', async () => {
    // the archive has 11 tasks: page 9 is past the end
    serve({ 1: { tasks: [archived('a')], total: 11 }, 2: { tasks: [archived('b')], total: 11 }, 9: { tasks: [], total: 11 } })
    const page = await render(ArchiveView, { path: '/archive?page=9', user: makeUser() })
    await vi.waitFor(() => expect(page.router.currentRoute.value.query.page).toBe('2'))
  })

  it('filters by whose and which project, back to the first page, and clears', async () => {
    const server = serve()
    const page = await render(ArchiveView, { path: '/archive', user: makeUser() })
    await choose(t('archive.whose'), 'Acme')
    expect(server.to('GET /archive').at(-1)?.params).toMatchObject({ with: 'u-client' })
    await choose(t('archive.project'), 'Landing')
    expect(server.to('GET /archive').at(-1)?.params).toMatchObject({ with: 'u-client', project: 'p-1' })

    server.reply('GET /archive', { tasks: [], total: 0, page: 1, limit: 10 })
    await choose(t('archive.whose'), t('archive.personal'))
    expect(page.text()).toContain(t('archive.nothingMatches'))
    await click(button(t('archive.showAll')))
    expect(server.to('GET /archive').at(-1)?.params).toEqual({ with: undefined, project: undefined, page: undefined })
  })

  it('says when it is empty, or can’t load', async () => {
    serve({ 1: { tasks: [], total: 0 } })
    expect((await render(ArchiveView, { path: '/archive', user: makeUser() })).text()).toContain(t('archive.empty'))

    document.body.innerHTML = ''
    api({ 'GET /archive': status(500) })
    expect((await render(ArchiveView, { path: '/archive', user: makeUser({ role: 'client' }) })).text()).toContain(t('archive.loadFailed'))
  })
})
