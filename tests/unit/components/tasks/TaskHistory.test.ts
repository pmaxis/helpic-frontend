import { describe, expect, it } from 'vitest'
import TaskHistory from '@/components/tasks/TaskHistory.vue'
import TaskActivity from '@/components/tasks/TaskActivity.vue'
import { useToasts } from '@/composables/useToasts'
import { t } from '@/i18n'
import type { TaskEvent } from '@/types/history'
import { api, render, status } from '../../../helpers'
import { $$, click } from '../../../dom'
import { makeUser } from '../../../fixtures'

const me = makeUser()
let n = 0
const event = (kind: TaskEvent['kind'], data: TaskEvent['data'] = {}): TaskEvent => ({
  id: `h${++n}`,
  actor: { id: me.id, name: me.name, email: me.email },
  kind,
  data,
  created_at: '2030-01-10T09:00:00Z',
})

describe('TaskHistory', () => {
  it('words every kind of change, with its values', async () => {
    const events = [
      event('created'),
      event('title', { from: 'Old', to: 'New' }),
      event('description'),
      event('due_on', { from: null, to: '2030-01-20' }),
      event('due_on', { from: '2030-01-20', to: null }),
      event('due_on', { from: '2030-01-20', to: '2030-01-25' }),
      event('project', { from: null, to: 'Landing' }),
      event('project', { from: 'Landing', to: null }),
      event('project', { from: 'Landing', to: 'Shop' }),
      event('status', { from: 'New', to: 'Done' }),
      event('price', { from: null, to: 1000, currency: 'EUR' }),
      event('price', { from: 1000, to: null }),
      event('price', { from: 1000, to: 2000 }),
      event('billing', { to: 'hourly' }),
      event('billing', { to: 'fixed' }),
      event('priority', { from: 'high', to: 'none' }),
      event('priority', { from: 'none', to: 'urgent' }),
      event('labels', { added: ['Bug'], removed: ['Idea'] }),
      event('labels', { added: ['Bug', 'UI'] }),
      event('labels', { removed: ['Idea'] }),
      event('attachment_added', { name: 'brief.pdf' }),
      event('attachment_removed', { name: 'brief.pdf' }),
      event('archived', { report: 'January' }),
      event('archived'),
      event('subtask_added', { title: 'Header' }),
      event('subtask_removed', { title: 'Footer' }),
      event('something new' as TaskEvent['kind']),
    ]
    api({ 'GET /tasks/t-1/history': { events } })
    const history = await render(TaskHistory, { props: { taskId: 't-1' }, user: me })
    const text = history.text()
    for (const value of ['“Old”', '“New”', '20 Jan 2030', '25 Jan 2030', '“Landing”', '“Shop”', '€10.00', '$20.00', 'Urgent', 'Bug, UI', 'Idea', '“brief.pdf”', '“January”', '“Header”', '“Footer”']) {
      expect(text).toContain(value)
    }
    expect(history.findAll('li')).toHaveLength(events.length)
    expect(text).toContain(t('common.you_capital'))
  })

  it('reloads when the task changes, and says when it can’t load', async () => {
    const server = api({ 'GET /tasks/t-1/history': { events: [] } })
    const history = await render(TaskHistory, { props: { taskId: 't-1', version: 'a' }, user: me })
    await history.setProps({ version: 'b' })
    await new Promise((r) => setTimeout(r))
    expect(server.to('GET /tasks/t-1/history')).toHaveLength(2)

    server.reply('GET /tasks/t-1/history', status(500))
    await history.setProps({ version: 'c' })
    await new Promise((r) => setTimeout(r))
    expect(useToasts().toasts.at(-1)?.message).toBe(t('history.loadFailed'))
  })
})

describe('TaskActivity', () => {
  it('has the time tab only for whoever sees the time, falling back to comments', async () => {
    api({ 'GET /comments': { comments: [] }, 'GET /time-entries': { entries: [] }, 'GET /tasks/t-1/history': { events: [] } })
    const activity = await render(TaskActivity, { props: { taskId: 't-1', showTime: true, canTrack: true }, user: me })
    expect($$('[role="tab"]').map((b) => b.textContent?.trim())).toHaveLength(3)
    await click($$('[role="tab"]')[1])
    expect($$('[role="tab"]')[1].getAttribute('aria-selected')).toBe('true')
    await activity.setProps({ showTime: false })
    expect($$('[role="tab"]')).toHaveLength(2)
    expect($$('[role="tab"]')[0].getAttribute('aria-selected')).toBe('true')
    await click($$('[role="tab"]')[1])
    expect(activity.text()).toContain(t('history.empty'))
  })
})
