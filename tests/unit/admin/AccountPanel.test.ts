import { describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import AccountPanel from '@/admin/components/AccountPanel.vue'
import TrendChart from '@/admin/components/TrendChart.vue'
import KpiTile from '@/admin/components/KpiTile.vue'
import DeltaBadge from '@/admin/components/DeltaBadge.vue'
import ActivityHeatmap from '@/admin/components/ActivityHeatmap.vue'
import AccountAvatar from '@/admin/components/AccountAvatar.vue'
import { t } from '@/i18n'
import { useToasts } from '@/composables/useToasts'
import { api, render, status, type Reply } from '../../helpers'
import { $, $$, button, click, type } from '../../dom'
import { admin, makeAccountDetail, makeAction, makeLimit, makeSession } from '../../admin-fixtures'

function serve(extra: Record<string, Reply> = {}) {
  return api({
    'GET /admin/users/u1': { user: makeAccountDetail({ two_factor: true, team: { name: 'Acme', role: 'owner', members: 3 } }) },
    'GET /admin/users/u1/sessions': { sessions: [makeSession()] },
    'GET /admin/limits': { limits: [makeLimit()] },
    'GET /admin/actions': (c: { params: { page: number } }) => ({
      actions: Array.from({ length: c.params.page === 2 ? 2 : 10 }, (_, i) => makeAction({ id: i + c.params.page * 100, action: i ? 'clear_limit' : 'block', reason: i ? 'sign-in' : 'Spam' })),
      page: c.params.page,
      limit: 10,
      total: 12,
    }),
    ...extra,
  })
}

const confirmIn = (label: string) => $$('[role="dialog"] button').find((b) => b.textContent?.trim().startsWith(label)) as HTMLButtonElement

async function answer(reason: string, code: string) {
  const dialog = $('[role="dialog"]')!
  await type(dialog.querySelector('textarea')!, reason)
  await type(dialog.querySelector('input')!, code)
}

describe('AccountPanel', () => {
  it('shows the account in full: badges, team, usage, devices and the limits on it', async () => {
    serve()
    const panel = await render(AccountPanel, { props: { id: 'u1' }, user: admin() })
    const text = panel.text()
    expect(text).toContain('olena@example.test')
    expect(text).toContain('2FA')
    expect(text).toContain('Acme')
    expect(text).toContain('1h 30m')
    expect(text).toContain('Chrome on macOS')
    expect(text).toContain(t('admin.limits.scopes.sign-in'))
    expect(text).toContain('12')
  })

  it('blocks the account with a reason and the admin’s code, keeping a wrong code in the question', async () => {
    const server = serve({ 'POST /admin/users/u1/block': status(422, { error: { code: 'V', message: 'x', fields: { code: 'Wrong code' } } }) })
    const panel = await render(AccountPanel, { props: { id: 'u1' }, user: admin() })
    await click(button(t('admin.manage.block')))
    expect(confirmIn(t('admin.manage.block')).disabled).toBe(true)
    await answer(' Spam ', '123456')
    await click(confirmIn(t('admin.manage.block')))
    expect(server.to('POST /admin/users/u1/block')[0].body).toEqual({ reason: 'Spam', code: '123456' })
    expect($('[role="dialog"]')?.textContent).toContain('Wrong code')

    server.reply('POST /admin/users/u1/block', { user: makeAccountDetail({ blocked_at: '2030-03-14T00:00:00Z' }) })
    await click(confirmIn(t('admin.manage.block')))
    expect(useToasts().toasts.at(-1)?.message).toBe(t('admin.manage.done'))
    expect(panel.emitted('changed')).toHaveLength(1)
    expect(panel.text()).toContain(t('admin.manage.blocked'))
    expect(() => button(t('admin.manage.unblock'))).not.toThrow()
  })

  it('says a failure that isn’t the code, and gives up on a question with Cancel', async () => {
    serve({ 'POST /admin/users/u1/end-sessions': status(500) })
    await render(AccountPanel, { props: { id: 'u1' }, user: admin() })
    await click(button(t('admin.manage.endSessionsShort')))
    await answer('', '1')
    await click(confirmIn(t('admin.manage.endSessions')))
    expect(useToasts().toasts.at(-1)?.message).toBe(t('admin.manage.failed'))
    await click(confirmIn(t('common.cancel')))
    expect($('[role="dialog"]')).toBeNull()
  })

  it('signs the account out of one device, and lifts a limit', async () => {
    const server = serve({ 'POST /admin/users/u1/sessions/s1/end': { user: makeAccountDetail({ sessions: 0 }) } })
    await render(AccountPanel, { props: { id: 'u1' }, user: admin() })
    await click(button(t('admin.account.endSession')))
    await answer('Lost phone', '654321')
    await click(confirmIn(t('admin.account.endSession')))
    expect(server.to('POST /admin/users/u1/sessions/s1/end')[0].body).toEqual({ reason: 'Lost phone', code: '654321' })

    await click(button(t('admin.limits.clear')))
    expect(server.to('POST /admin/limits/clear')[0].body).toEqual({ scope: 'sign-in', key: 'k1' })
    expect(useToasts().toasts.at(-1)?.message).toBe(t('admin.limits.cleared'))
  })

  it('reloads the devices when lifting a limit fails', async () => {
    const server = serve({ 'POST /admin/limits/clear': status(500) })
    await render(AccountPanel, { props: { id: 'u1' }, user: admin() })
    await click(button(t('admin.limits.clear')))
    expect(useToasts().toasts.at(-1)?.message).toBe(t('admin.limits.failed'))
    expect(server.to('GET /admin/users/u1/sessions')).toHaveLength(2)
  })

  it('shows the account’s history on its tab, a page at a time, a lifted limit named', async () => {
    const server = serve()
    const panel = await render(AccountPanel, { props: { id: 'u1' }, user: admin() })
    await click($$('nav button').find((b) => b.textContent?.includes(t('admin.account.tabs.history')))!)
    expect(panel.text()).toContain('Spam')
    expect(panel.text()).toContain(t('admin.limits.scopes.sign-in'))
    await click($$('button').find((b) => b.textContent?.trim() === '2')!)
    expect(server.to('GET /admin/actions').at(-1)?.params).toMatchObject({ target: 'u1', page: 2 })
  })

  it('closes on Escape, but Escape in a question closes only the question', async () => {
    serve()
    const panel = await render(AccountPanel, { props: { id: 'u1' }, user: admin() })
    await click(button(t('admin.manage.block')))
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await flushPromises()
    expect(panel.emitted('close')).toBeUndefined()
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    expect(panel.emitted('close')).toHaveLength(1)
  })

  it('closes when the account can’t load, and says a history that can’t', async () => {
    api({ 'GET /admin/users/u1': status(500) })
    const panel = await render(AccountPanel, { props: { id: 'u1' }, user: admin() })
    expect(panel.emitted('close')).toHaveLength(1)

    serve({ 'GET /admin/actions': status(500), 'GET /admin/users/u1/sessions': status(500), 'GET /admin/limits': { limits: [] } })
    const quiet = await render(AccountPanel, { props: { id: 'u1' }, user: admin() })
    expect(useToasts().toasts.at(-1)?.message).toBe(t('admin.loadFailed'))
    await quiet.setProps({ id: 'u1' })
  })
})

describe('the admin chart pieces', () => {
  it('draws the trend with a tooltip on the hovered or focused point, empty with nothing in it', async () => {
    const points = Array.from({ length: 5 }, (_, i) => ({ key: `d${i}`, label: `D${i}`, title: `Day ${i}`, previousTitle: `Before ${i}`, current: i * 2, previous: i }))
    const props = { points, label: 'Active', currentName: 'This period', previousName: 'Before', emptyText: 'Nothing yet' }
    const chart = mount(TrendChart, { props, attachTo: document.body })
    const hit = chart.get('[aria-label="Day 2: 4; Before 2: 2"]')
    await hit.trigger('mouseenter')
    expect(chart.get('[role="tooltip"]').text()).toMatch(/Day 2.*4.*Before 2.*2/)
    await hit.trigger('mouseleave')
    expect(chart.find('[role="tooltip"]').exists()).toBe(false)
    await hit.trigger('focus')
    expect(chart.find('[role="tooltip"]').exists()).toBe(true)
    const empty = mount(TrendChart, { props: { ...props, points: points.map((p) => ({ ...p, current: 0, previous: 0 })) } })
    expect(empty.text()).toContain('Nothing yet')
  })

  it('picks a headline figure from its tile, with its change against the period before', async () => {
    const tile = mount(KpiTile, { props: { label: 'Sign-ups', value: 6, previous: 3, series: [1, 2, 3], selected: true } })
    expect(tile.text()).toContain('6')
    expect(tile.text()).toContain('100%')
    await tile.trigger('click')
    expect(tile.emitted('select')).toHaveLength(1)

    expect(mount(DeltaBadge, { props: { now: 5, before: 10 } }).text()).toContain('50%')
    expect(mount(DeltaBadge, { props: { now: 5, before: 5 } }).text()).toContain('0%')
    expect(mount(DeltaBadge, { props: { now: 5, before: 0 } }).text()).toBe('')
  })

  it('marks the active days since a Monday, and names an account by its initials', () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(2030, 1, 20))
    const heat = mount(ActivityHeatmap, { props: { since: '2030-01-07', days: ['2030-01-08', '2030-02-03'] } })
    expect(heat.findAll('.bg-emerald-500')).toHaveLength(2)
    expect(heat.findAll('.invisible').length).toBeGreaterThan(0)
    expect(heat.text()).toContain('Feb')
    vi.useRealTimers()
    expect(mount(AccountAvatar, { props: { name: 'Olena Kit', email: 'o@x', size: 'lg' } }).text()).toBe('OK')
    expect(mount(AccountAvatar, { props: { name: '', email: 'root@x' } }).text()).toBe('RO')
  })
})
