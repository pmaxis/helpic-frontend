import { describe, expect, it, vi } from 'vitest'
import NotificationBell from '@/components/navigation/NotificationBell.vue'
import { t } from '@/i18n'
import { useNotificationsStore } from '@/stores/notifications'
import type { AppNotification } from '@/types/notifications'
import { api, render } from '../../../helpers'
import { $, $$, button, click, pressOutside } from '../../../dom'

let n = 0
const note = (kind: AppNotification['kind'], over: Partial<AppNotification> = {}): AppNotification =>
  ({
    id: `n${++n}`,
    kind,
    actor: { id: 'a', name: 'Acme', email: 'a@x' },
    task_id: null,
    project_id: null,
    report_id: null,
    subject: 'Hero',
    detail: '',
    read: false,
    created_at: new Date().toISOString(),
    ...over,
  }) as AppNotification

async function openBell(items: AppNotification[]) {
  const server = api({ 'GET /notifications': { notifications: items, unread: items.filter((i) => !i.read).length } })
  const bell = await render(NotificationBell, { path: '/dashboard' })
  await click($('button')!)
  return { server, bell }
}

describe('NotificationBell', () => {
  it('loads the list on first open, wording each kind', async () => {
    const { server } = await openBell([
      note('task_status', { detail: 'Done', task_id: 't1' }),
      note('task_overdue', { actor: null, detail: '2030-01-10' }),
      note('attachment_added', { detail: 'brief.pdf' }),
      note('something_new' as AppNotification['kind'], { read: true }),
    ])
    const panel = $('[role="dialog"]')!.textContent!
    expect(panel).toContain('Acme')
    expect(panel).toContain(t('status.done'))
    expect(panel).toContain('10 Jan 2030')
    expect(panel).toContain('brief.pdf')
    expect($('button')?.getAttribute('title')).toBe(t('bell.newCount', { n: 3 }, 3))
    expect(server.to('GET /notifications')).toHaveLength(1)
    await click($('button')!)
    await click($('button')!)
    expect(server.to('GET /notifications')).toHaveLength(1)
  })

  it('opens what a notification is about, marking it read', async () => {
    const targets: [Partial<AppNotification>, string][] = [
      [{ report_id: 'r1' }, '/reports/r1'],
      [{ task_id: 't1' }, '/tasks/t1'],
      [{ project_id: 'p1' }, '/projects/p1'],
      [{ kind: 'client_joined' }, '/clients'],
      [{ kind: 'freelancer_joined' }, '/freelancers'],
      [{ kind: 'member_joined' }, '/team'],
    ]
    for (const [over, path] of targets) {
      document.body.innerHTML = ''
      useNotificationsStore().$reset()
      const { server, bell } = await openBell([note(over.kind ?? 'task_created', over)])
      await click($$('[role="dialog"] li button, [role="dialog"] ul button')[0])
      await vi.waitFor(() => expect(bell.router.currentRoute.value.path).toBe(path))
      expect(server.calls.some((c) => c.method === 'POST' && c.url.endsWith('/read'))).toBe(true)
    }
  })

  it('marks all read, and says when there’s nothing', async () => {
    const { server } = await openBell([note('task_created')])
    await click(button(t('bell.markAllRead')))
    expect(server.to('POST /notifications/read-all')).toHaveLength(1)

    document.body.innerHTML = ''
    useNotificationsStore().$reset()
    await openBell([])
    expect($('[role="dialog"]')?.textContent).toContain(t('bell.caughtUp'))
  })

  it('closes on Escape or a press outside', async () => {
    await openBell([])
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await Promise.resolve()
    await new Promise((r) => setTimeout(r))
    expect($('[role="dialog"]')).toBeNull()
    await click($('button')!)
    window.dispatchEvent(new Event('resize'))
    await pressOutside()
    expect($('[role="dialog"]')).toBeNull()
  })
})
