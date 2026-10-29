import { afterEach, describe, expect, it, vi } from 'vitest'
import SharedTaskView from '@/views/SharedTaskView.vue'
import { t } from '@/i18n'
import type { SharedTask } from '@/types/shares'
import { api, render, status } from '../../helpers'
import { $, button, click } from '../../dom'
import { makeUser } from '../../fixtures'

URL.createObjectURL = vi.fn(() => 'blob:preview')
URL.revokeObjectURL = vi.fn()

afterEach(() => {
  vi.useRealTimers()
  document.head.querySelectorAll('meta[name="robots"]').forEach((m) => m.remove())
})

const shared = (over: Partial<SharedTask> = {}): SharedTask => ({
  title: 'Logo',
  description: 'Two variants',
  status: 'in_progress',
  status_name: 'Review',
  due_on: '2030-05-01',
  archived: false,
  subtasks: [
    { title: 'Sketches', status: 'done', status_name: 'Done' },
    { title: 'Colours', status: 'new', status_name: 'New' },
  ],
  files: [
    { id: 'f-img', file_name: 'mock.png', content_type: 'image/png', size_bytes: 2048, is_image: true, scan: 'clean' },
    { id: 'f-pdf', file_name: 'brief.pdf', content_type: 'application/pdf', size_bytes: 4096, is_image: false, scan: 'clean' },
    { id: 'f-bad', file_name: 'evil.exe', content_type: 'application/octet-stream', size_bytes: 10, is_image: false, scan: 'infected' },
  ],
  ...over,
})

/** The shared task's API: the task and its files' bytes. */
function serve(task: SharedTask = shared()) {
  return api({
    'GET /shared/tok': { task },
    'GET /shared/tok/files/f-img': new Blob(['x']),
    'GET /shared/tok/files/f-pdf': new Blob(['%PDF']),
  })
}

describe('SharedTaskView', () => {
  it('shows the task to a guest, read-only, and keeps it out of search engines', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(2030, 3, 28))
    const server = serve()
    const page = await render(SharedTaskView, { path: '/share/tok', props: { token: 'tok' }, user: null })
    expect(page.find('h1').text()).toBe('Logo')
    expect(page.text()).toContain('Review')
    expect(page.text()).toContain(t('shared.due', { date: '1 May 2030' }))
    expect(page.text()).toContain(t('shared.dueIn', 3))
    expect(page.text()).toContain('Two variants')
    // the subtasks, and how far along they are
    expect(page.text()).toContain('Sketches')
    expect(page.text()).toContain(t('subtasks.progress', { done: 1, total: 2 }))
    expect(page.find('[role="progressbar"]').attributes('aria-valuenow')).toBe('50')
    // the picture in the gallery, the others in the list; the infected one not offered
    expect(server.to('GET /shared/tok/files/f-img')[0].params).toEqual({ inline: 1 })
    expect(page.find('img').attributes('src')).toBe('blob:preview')
    expect(page.text()).toContain(t('shared.fileRemoved'))
    expect(page.find(`[aria-label="${t('attachments.downloadNamed', { name: 'evil.exe' })}"]`).exists()).toBe(false)
    // nothing to change; a guest is shown what Helpic is
    expect(page.findAll('textarea, input').length).toBe(0)
    expect(page.text()).toContain(t('shared.promo.title', { app: 'Helpic' }))
    expect(page.find('a[href="/register"]').exists()).toBe(true)
    expect(page.find('a[aria-label="Helpic"]').attributes('href')).toBe('/login')
    expect(document.head.querySelector('meta[name="robots"]')?.getAttribute('content')).toBe('noindex, nofollow')
    page.unmount()
    expect(document.head.querySelector('meta[name="robots"]')).toBeNull()
  })

  it('says when it’s overdue, and nothing of the kind once it’s done', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(2030, 4, 3))
    serve()
    let page = await render(SharedTaskView, { path: '/share/tok', props: { token: 'tok' }, user: null })
    expect(page.text()).toContain(t('shared.overdueBy', 2))
    page.unmount()

    serve(shared({ status: 'done', status_name: 'Done', archived: true }))
    page = await render(SharedTaskView, { path: '/share/tok', props: { token: 'tok' }, user: null })
    expect(page.text()).not.toContain(t('shared.overdueBy', 2))
    expect(page.text()).toContain(t('shared.archived'))
  })

  it('opens the files in the viewer through the link, and downloads them', async () => {
    const server = serve()
    const page = await render(SharedTaskView, { path: '/share/tok', props: { token: 'tok' }, user: makeUser() })
    // a signed-in viewer isn't asked to sign up, but led back to their work
    expect(page.find('a[href="/register"]').exists()).toBe(false)
    expect(page.find('aside a[href="/dashboard"]').text()).toBe(t('shared.promo.open', { app: 'Helpic' }))

    await click(button(`${t('attachments.open')} mock.png`))
    expect($('[role="dialog"]')?.getAttribute('aria-label')).toBe('mock.png')
    // the next file comes from the link too
    await click(button(t('attachments.next')))
    expect(server.to('GET /shared/tok/files/f-pdf')).toHaveLength(1)
    await click(button(t('ui.close')))

    await click(button(t('attachments.downloadNamed', { name: 'brief.pdf' })))
    expect(server.to('GET /shared/tok/files/f-pdf').at(-1)?.params).toEqual({})
  })

  it('says a link that was turned off opens nothing, and offers to retry anything else', async () => {
    api({ 'GET /shared/gone': status(404) })
    const gone = await render(SharedTaskView, { path: '/share/gone', props: { token: 'gone' }, user: null })
    expect(gone.text()).toContain(t('shared.goneTitle'))
    expect(gone.text()).not.toContain(t('shared.retry'))
    gone.unmount()

    const server = api({ 'GET /shared/tok': status(500) })
    const page = await render(SharedTaskView, { path: '/share/tok', props: { token: 'tok' }, user: null })
    expect(page.text()).toContain(t('shared.failedTitle'))
    server.reply('GET /shared/tok', { task: shared({ files: [], subtasks: [] }) })
    await click(button(t('shared.retry')))
    expect(page.find('h1').text()).toBe('Logo')
  })
})
