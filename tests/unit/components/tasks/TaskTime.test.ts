import { describe, expect, it } from 'vitest'
import TaskTime from '@/components/tasks/TaskTime.vue'
import { t } from '@/i18n'
import { useTimerStore } from '@/stores/timer'
import { useToasts } from '@/composables/useToasts'
import { api, render, status } from '../../../helpers'
import { button, click, field, type } from '../../../dom'
import { makeTimeEntry, makeUser } from '../../../fixtures'

const me = makeUser()

function mountTime(entries = [makeTimeEntry({ seconds: 5400, note: 'Layout' })], props = {}) {
  const server = api({ 'GET /time-entries': { entries } })
  return { server, view: render(TaskTime, { props: { taskId: 't-1', canTrack: true, ...props }, user: me }) }
}

describe('TaskTime', () => {
  it('lists the time with its total, the running entry ticking', async () => {
    const { view } = mountTime([makeTimeEntry({ seconds: 5400 }), makeTimeEntry({ id: 'e2', seconds: 60, running_since: '2030-01-10T09:00:00Z' })])
    const time = await view
    // 60 s on the entry before it started, and the minute it has run since
    useTimerStore().set(makeTimeEntry({ id: 'e2', seconds: 60, running_since: new Date(Date.now() - 60_000).toISOString() }))
    await new Promise((r) => setTimeout(r))
    expect(time.emitted('total')?.at(-1)?.[0]).toBe(5400 + 120)
    useTimerStore().reset()
    expect(time.text()).toContain('1h 30m')
  })

  it('writes time by hand, then reloads', async () => {
    const { server, view } = mountTime([])
    const time = await view
    await type(field(t('timelog.duration')), '1:30')
    await type(field(t('timelog.note')), 'Review')
    server.reply('GET /time-entries', { entries: [makeTimeEntry({ seconds: 5400, note: 'Review' })] })
    await time.get('form').trigger('submit')
    await new Promise((r) => setTimeout(r))
    expect(server.to('POST /time-entries')[0].body).toMatchObject({ duration: '1:30', note: 'Review' })
    expect(time.emitted('changed')).toHaveLength(1)
    expect(time.text()).toContain('Review')
  })

  it('sends nothing without a duration, and shows the fields the API refused', async () => {
    const { server, view } = mountTime([])
    const time = await view
    await time.get('form').trigger('submit')
    expect(server.to('POST /time-entries')).toHaveLength(0)
    server.reply('POST /time-entries', status(422, { error: { code: 'V', message: 'Bad', fields: { duration: 'Like 1:30' } } }))
    await type(field(t('timelog.duration')), 'soon')
    await time.get('form').trigger('submit')
    await new Promise((r) => setTimeout(r))
    expect(time.text()).toContain('Like 1:30')
  })

  it('changes an entry in its form, and deletes one after asking', async () => {
    const { server, view } = mountTime()
    const time = await view
    await click(button(t('timelog.edit')))
    expect(field(t('timelog.duration')).value).toBe('1:30')
    server.reply('PUT /time-entries/e-1', { entry: makeTimeEntry({ seconds: 7200, note: 'Layout' }) })
    await type(field(t('timelog.duration')), '2:00')
    await time.get('form').trigger('submit')
    await new Promise((r) => setTimeout(r))
    expect(server.to('PUT /time-entries/e-1')).toHaveLength(1)

    await click(button(t('timelog.delete')))
    await click([...document.querySelectorAll('[role="dialog"] button')].find((b) => b.textContent?.includes(t('timelog.delete')))!)
    expect(server.to('DELETE /time-entries/e-1')).toHaveLength(1)
    expect(time.emitted('changed')).toHaveLength(2)
  })

  it('reloads when the timer touched this task, and has no form once billed', async () => {
    // A billed task can't be tracked any more: its page passes canTrack false.
    const { server, view } = mountTime([], { billed: true, canTrack: false })
    const time = await view
    expect(time.find('form').exists()).toBe(false)
    expect(time.text()).toContain(t('timelog.billed'))
    useTimerStore().changed('t-1')
    await new Promise((r) => setTimeout(r))
    expect(server.to('GET /time-entries')).toHaveLength(2)
  })

  it('says when the time can’t load', async () => {
    api({ 'GET /time-entries': status(500) })
    await render(TaskTime, { props: { taskId: 't-1' }, user: me })
    expect(useToasts().toasts.at(-1)?.message).toBe(t('timelog.loadFailed'))
  })
})
