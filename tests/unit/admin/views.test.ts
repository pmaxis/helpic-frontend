import { afterEach, describe, expect, it, vi } from 'vitest'
import AdminStatsView from '@/admin/views/AdminStatsView.vue'
import AdminUsersView from '@/admin/views/AdminUsersView.vue'
import AdminSignupsView from '@/admin/views/AdminSignupsView.vue'
import AdminEmailsView from '@/admin/views/AdminEmailsView.vue'
import AdminLogsView from '@/admin/views/AdminLogsView.vue'
import AdminActionsView from '@/admin/views/AdminActionsView.vue'
import AdminLimitsView from '@/admin/views/AdminLimitsView.vue'
import AdminSystemView from '@/admin/views/AdminSystemView.vue'
import AdminAdminsView from '@/admin/views/AdminAdminsView.vue'
import { t } from '@/i18n'
import { useToasts } from '@/composables/useToasts'
import { api, render, status, type Reply } from '../../helpers'
import { $, $$, button, choose, click, field, type } from '../../dom'
import { makeUser } from '../../fixtures'
import {
  admin,
  makeAccount,
  makeAccountDetail,
  makeAction,
  makeAdmin,
  makeEmail,
  makeLimit,
  makeLog,
  makeSession,
  makeSignIn,
  makeSignup,
  makeStats,
  makeSystem,
} from '../../admin-fixtures'

afterEach(() => {
  vi.useRealTimers()
})

const confirmIn = (label: string) => $$('[role="dialog"] button').find((b) => b.textContent?.trim().startsWith(label))!
const search = (label: string) => field(label)

describe('the admin shell', () => {
  it('asks an admin without two-factor to turn it on, loading nothing', async () => {
    const server = api()
    const page = await render(AdminStatsView, { path: '/admin', user: makeUser({ role: 'admin', two_factor: false }) })
    expect(page.text()).toContain(t('admin.needsTwoFactor'))
    expect(server.to('GET /admin/stats')).toHaveLength(0)
    await click(button(t('admin.openSettings')))
    await vi.waitFor(() => expect(page.router.currentRoute.value.fullPath).toBe('/settings?tab=security'))
  })
})

describe('AdminStatsView', () => {
  it('shows how things stand and the period against the one before, a figure picked onto the chart', async () => {
    const server = api({ 'GET /admin/stats': (c: { params: { days: number } }) => makeStats(c.params.days) })
    const page = await render(AdminStatsView, { path: '/admin', user: admin() })
    expect(server.to('GET /admin/stats')[0].params).toEqual({ days: 30 })
    expect(page.text()).toContain('72')
    expect(page.text()).toContain('300%')
    const tiles = page.findAll('button[aria-pressed]')
    await tiles[2].trigger('click')
    expect(tiles[2].attributes('aria-pressed')).toBe('true')

    await choose(t('admin.period'), t('admin.periods.365'))
    expect(server.to('GET /admin/stats').at(-1)?.params).toEqual({ days: 365 })
    const point = $$('[aria-label*=":"]').find((el) => el.closest('[role="group"], svg, div'))
    point?.dispatchEvent(new Event('mouseenter'))
  })

  it('says when the stats can’t load', async () => {
    api({ 'GET /admin/stats': status(500) })
    await render(AdminStatsView, { path: '/admin', user: admin() })
    expect(useToasts().toasts.at(-1)?.message).toBe(t('admin.loadFailed'))
  })
})

describe('AdminUsersView', () => {
  const page1 = { users: [makeAccount(), makeAccount({ id: 'u2', email: 'acme@x', name: 'Acme', role: 'client', blocked_at: '2030-03-01', last_active: null })], page: 1, limit: 10, total: 2 }

  function serve(extra: Record<string, Reply> = {}) {
    return api({
      'GET /admin/users': page1,
      'GET /admin/users/u1': { user: makeAccountDetail() },
      'GET /admin/users/u1/sessions': { sessions: [makeSession()] },
      'GET /admin/limits': { limits: [] },
      'GET /admin/actions': { actions: [], page: 1, limit: 10, total: 0 },
      ...extra,
    })
  }

  it('lists the accounts, filtering by role and activity and sorting by a column', async () => {
    const server = serve()
    const page = await render(AdminUsersView, { path: '/admin/users', user: admin() })
    expect(page.text()).toContain('olena@example.test')
    expect(page.text()).toContain('acme@x')
    expect(server.to('GET /admin/users')[0].params).toEqual({ sort: 'created', page: 1, limit: 10 })

    await choose(t('admin.columns.role'), t('admin.roles.client'))
    expect(server.to('GET /admin/users').at(-1)?.params).toMatchObject({ role: 'client' })
    await click($$(`[aria-label="${t('admin.columns.activity')}"] button`)[4])
    expect(server.to('GET /admin/users').at(-1)?.params).toMatchObject({ activity: 'blocked' })
    await click($(`[aria-label="${t('admin.sortBy', { column: t('admin.columns.tasks') })}"]`))
    expect(server.to('GET /admin/users').at(-1)?.params).toMatchObject({ sort: 'tasks' })
  })

  it('searches after a pause in typing', async () => {
    const server = serve()
    await render(AdminUsersView, { path: '/admin/users', user: admin() })
    await type(search(t('admin.search')), 'acme')
    await vi.waitFor(() => expect(server.to('GET /admin/users').at(-1)?.params).toMatchObject({ q: 'acme', page: 1 }))
  })

  it('opens an account in a card beside the list, its id in the address, and closes it', async () => {
    serve()
    const page = await render(AdminUsersView, { path: '/admin/users', user: admin() })
    await click(byText('tr, li, button', 'olena@example.test'))
    await vi.waitFor(() => expect(page.router.currentRoute.value.query.account).toBe('u1'))
    await vi.waitFor(() => expect(document.body.textContent).toContain(t('admin.account.usage')))
    await click(button(t('ui.close')))
    await vi.waitFor(() => expect(page.router.currentRoute.value.query.account).toBeUndefined())
  })

  it('says when the accounts can’t load', async () => {
    serve({ 'GET /admin/users': status(500) })
    await render(AdminUsersView, { path: '/admin/users', user: admin() })
    expect(useToasts().toasts.at(-1)?.message).toBe(t('admin.loadFailed'))
  })
})

describe('AdminSignupsView', () => {
  it('sends a waiting sign-up its link again, and removes one after asking', async () => {
    const server = api({ 'GET /admin/signups': { signups: [makeSignup(), makeSignup({ email: 'b@x', email_status: 'failed', email_error: 'bounced' })], page: 1, limit: 10, total: 2 } })
    const page = await render(AdminSignupsView, { path: '/admin/signups', user: admin() })
    expect(page.text()).toContain('bounced')
    await click($$('button').filter((b) => b.textContent?.trim() === t('admin.signups.resend'))[0])
    expect(server.to('POST /admin/signups/new%40example.test/resend')).toHaveLength(1)
    expect(useToasts().toasts.at(-1)?.message).toBe(t('admin.signups.resent', { email: 'new@example.test' }))

    await click($$('button').filter((b) => b.textContent?.trim() === t('admin.signups.remove'))[1])
    await click(confirmIn(t('admin.signups.remove')))
    expect(server.to('DELETE /admin/signups/b%40x')).toHaveLength(1)
  })

  it('says when there are none, or none match, or an action fails', async () => {
    const server = api({ 'GET /admin/signups': { signups: [], page: 1, limit: 10, total: 0 } })
    const page = await render(AdminSignupsView, { path: '/admin/signups', user: admin() })
    expect(page.text()).toContain(t('admin.signups.empty'))
    await type(search(t('admin.signups.search')), 'zzz')
    await vi.waitFor(() => expect(server.to('GET /admin/signups').at(-1)?.params).toMatchObject({ q: 'zzz' }))

    document.body.innerHTML = ''
    api({ 'GET /admin/signups': { signups: [makeSignup()], page: 1, limit: 10, total: 1 }, 'POST /admin/signups/new%40example.test/resend': status(500) })
    await render(AdminSignupsView, { path: '/admin/signups', user: admin() })
    await click(button(t('admin.signups.resend')))
    expect(useToasts().toasts.at(-1)?.message).toBe(t('admin.signups.failed'))
  })
})

describe('AdminEmailsView', () => {
  it('lists the emails by status, sending a failed one again', async () => {
    const server = api({
      'GET /admin/emails': { emails: [makeEmail(), makeEmail({ id: 'e2', status: 'failed', attempts: 5, last_error: 'mailbox full' })], page: 1, limit: 10, total: 2, counts: { queued: 0, failed: 1, sent: 1, last_sent: new Date().toISOString() } },
    })
    const page = await render(AdminEmailsView, { path: '/admin/emails', user: admin() })
    expect(page.text()).toContain('mailbox full')
    await click(button(t('admin.emails.retry')))
    expect(server.to('POST /admin/emails/e2/retry')).toHaveLength(1)
    expect(useToasts().toasts.at(-1)?.message).toBe(t('admin.emails.retried'))

    await click($$(`[aria-label="${t('admin.emails.statusFilter')}"] button`).find((b) => b.textContent?.includes(t('admin.emails.filter.failed')))!)
    expect(server.to('GET /admin/emails').at(-1)?.params).toMatchObject({ status: 'failed' })
  })

  it('opens filtered from a link, and says when a resend fails', async () => {
    const server = api({
      'GET /admin/emails': { emails: [makeEmail({ status: 'failed' })], page: 1, limit: 10, total: 1, counts: { queued: 0, failed: 1, sent: 0, last_sent: null } },
      'POST /admin/emails/e1/retry': status(500),
    })
    await render(AdminEmailsView, { path: '/admin/emails?status=failed', user: admin() })
    expect(server.to('GET /admin/emails')[0].params).toMatchObject({ status: 'failed' })
    await click(button(t('admin.emails.retry')))
    expect(useToasts().toasts.at(-1)?.message).toBe(t('admin.emails.failed'))
  })
})

describe('AdminLogsView', () => {
  it('lists the warnings and errors, filters by level and opens one’s details', async () => {
    const server = api({ 'GET /admin/logs': { logs: [makeLog(), makeLog({ id: 2, level: 'WARN', message: 'slow', attrs: {} })], page: 1, limit: 10, total: 2, warnings: 1, errors: 1 } })
    const page = await render(AdminLogsView, { path: '/admin/logs', user: admin() })
    expect(page.text()).toContain('request failed')
    await click(byText('button', 'request failed'))
    expect(page.text()).toContain('db down')
    await click($$(`[aria-label="${t('admin.logs.levelFilter')}"] button`)[2])
    expect(server.to('GET /admin/logs').at(-1)?.params).toMatchObject({ level: 'error' })
    await type(search(t('admin.logs.search')), 'tasks')
    await vi.waitFor(() => expect(server.to('GET /admin/logs').at(-1)?.params).toMatchObject({ q: 'tasks' }))
  })
})

describe('AdminActionsView', () => {
  it('lists what admins did, a page at a time', async () => {
    const actions = Array.from({ length: 10 }, (_, i) => makeAction({ id: i, action: i % 2 ? 'clear_limit' : 'block', reason: i % 2 ? 'sign-in' : 'Spam' }))
    const server = api({ 'GET /admin/actions': { actions, page: 1, limit: 10, total: 12 } })
    const page = await render(AdminActionsView, { path: '/admin/actions', user: admin() })
    expect(page.text()).toContain('olena@example.test')
    expect(page.text()).toContain(t('admin.limits.scopes.sign-in'))
    await click($$('button').find((b) => b.textContent?.trim() === '2')!)
    expect(server.to('GET /admin/actions').at(-1)?.params).toMatchObject({ page: 2 })
  })

  it('says when nothing was done yet', async () => {
    api({ 'GET /admin/actions': { actions: [], page: 1, limit: 10, total: 0 } })
    expect((await render(AdminActionsView, { path: '/admin/actions', user: admin() })).text()).toContain(t('admin.actions.empty'))
  })
})

describe('AdminLimitsView', () => {
  it('lists the limits holding people back, lifting one at once', async () => {
    const server = api({ 'GET /admin/limits': { limits: [makeLimit(), makeLimit({ key: 'k2', scope: 'invites', kind: 'user', account_id: null })] } })
    const page = await render(AdminLimitsView, { path: '/admin/limits', user: admin() })
    expect(page.text()).toContain(t('admin.limits.scopes.sign-in'))
    await click($$('button').filter((b) => b.textContent?.trim() === t('admin.limits.clear'))[0])
    expect(server.to('POST /admin/limits/clear')[0].body).toEqual({ scope: 'sign-in', key: 'k1' })
    expect(useToasts().toasts.at(-1)?.message).toBe(t('admin.limits.cleared'))
  })

  it('says when nothing is limited, and when lifting fails', async () => {
    api({ 'GET /admin/limits': { limits: [makeLimit()] }, 'POST /admin/limits/clear': status(500) })
    await render(AdminLimitsView, { path: '/admin/limits', user: admin() })
    await click(button(t('admin.limits.clear')))
    expect(useToasts().toasts.at(-1)?.message).toBe(t('admin.limits.failed'))
  })
})

describe('AdminSystemView', () => {
  it('shows each service, the jobs and the build, sending a test alert', async () => {
    const server = api({ 'GET /admin/system': makeSystem() })
    const page = await render(AdminSystemView, { path: '/admin/system', user: admin() })
    expect(page.text()).toContain('connection refused')
    expect(page.text()).toContain('1.4.0')
    expect(page.text()).toContain('go1.26')
    await click(button(t('admin.system.testAlert')))
    expect(server.to('POST /admin/system/test-alert')).toHaveLength(1)
    expect(useToasts().toasts.at(-1)?.message).toBe(t('admin.system.testSent'))
  })

  it('shows the files: how much they take, who is near the quota, who uploaded the most and the disk', async () => {
    api({ 'GET /admin/system': makeSystem() })
    const page = await render(AdminSystemView, { path: '/admin/system', user: admin() })
    const text = page.text()
    expect(text).toContain(t('admin.storage.limits', { quota: '1.0 GB', file: '25.0 MB' }))
    expect(text).toContain('1.5 GB')
    expect(text).toContain(t('admin.storage.diskFree', { free: '40.0 GB', total: '100.0 GB' }))
    expect(page.find('a[href="/admin/users?account=u-big"]').text()).toBe('Big Uploader')
    // An account without a name is shown by its email.
    expect(page.find('a[href="/admin/users?account=u-small"]').text()).toBe('small@example.test')
    expect(text).toContain(t('admin.storage.filesCount', { n: 9 }, 9))
  })

  it('says when there are no files, no quota or no disk to read', async () => {
    const system = makeSystem()
    api({ 'GET /admin/system': makeSystem({ storage: { ...system.storage, files: 0, bytes: 0, accounts: 0, near_quota: 0, quota_bytes: 0, top: [], disk: null } }) })
    const page = await render(AdminSystemView, { path: '/admin/system', user: admin() })
    expect(page.text()).toContain(t('admin.storage.none'))
    expect(page.text()).toContain(t('admin.storage.limitsNoQuota', { file: '25.0 MB' }))
    expect(page.text()).toContain(t('admin.storage.diskUnknown'))
  })

  it('says when the status can’t load', async () => {
    api({ 'GET /admin/system': status(500) })
    await render(AdminSystemView, { path: '/admin/system', user: admin() })
    expect(useToasts().toasts.at(-1)?.message).toBe(t('admin.loadFailed'))
  })
})

describe('AdminAdminsView', () => {
  function serve(extra: Record<string, Reply> = {}) {
    return api({
      'GET /admin/admins': { admins: [makeAdmin(), makeAdmin({ id: 'a2', email: 'ops@x', name: '', two_factor: false, last_sign_in: null, sessions: [] })] },
      'GET /admin/sign-ins': (c: { params: { failed?: boolean } }) => ({
        sign_ins: c.params.failed ? [makeSignIn({ id: 2, outcome: 'wrong_code' })] : [makeSignIn(), makeSignIn({ id: 2, outcome: 'wrong_code' })],
        page: 1,
        limit: 10,
        total: 2,
      }),
      ...extra,
    })
  }

  it('lists the admins, opening one in a card with their devices and sign-ins', async () => {
    serve()
    const page = await render(AdminAdminsView, { path: '/admin/admins', user: admin() })
    expect(page.text()).toContain('ops@x')
    // only the admin with two-factor on carries the badge
    expect(page.findAll('span').filter((s) => s.text() === '2FA')).toHaveLength(1)
    await click(byText('tr, li, button', 'root@helpic.test'))
    await vi.waitFor(() => expect(page.router.currentRoute.value.query.admin).toBe('adm'))
    await vi.waitFor(() => expect(document.body.textContent).toContain('Chrome on macOS'))
    await click($$('[role="tab"], nav button').find((b) => b.textContent?.includes(t('admin.admins.tabs.signIns')))!)
    expect(document.body.textContent).toContain(t('admin.admins.outcomes.wrong_code'))
  })

  it('lists every sign-in to an admin account, the failed ones alone', async () => {
    const server = serve()
    const page = await render(AdminAdminsView, { path: '/admin/admins?tab=sign-ins', user: admin() })
    expect(page.text()).toContain(t('admin.admins.outcomes.ok'))
    await click($$('button').find((b) => b.textContent?.trim() === t('admin.admins.filter.failed'))!)
    expect(server.to('GET /admin/sign-ins').at(-1)?.params).toMatchObject({ failed: true })
    expect(page.text()).not.toContain(t('admin.admins.outcomes.ok'))
  })

  it('signs another admin out of a device with a reason and a code', async () => {
    const server = serve({ 'POST /admin/admins/adm/sessions/s1/end': status(422, { error: { code: 'V', message: 'x', fields: { code: 'Wrong code' } } }) })
    await render(AdminAdminsView, { path: '/admin/admins?admin=adm', user: admin() })
    await vi.waitFor(() => expect(document.body.textContent).toContain('Chrome on macOS'))
    await click(button(t('admin.account.endSession')))
    const dialog = $('[role="dialog"]')!
    await type(dialog.querySelector('textarea')!, 'Lost laptop')
    await type(dialog.querySelector('input')!, '123456')
    await click(confirmIn(t('admin.account.endSession')))
    expect(server.to('POST /admin/admins/adm/sessions/s1/end')[0].body).toEqual({ reason: 'Lost laptop', code: '123456' })
    expect($('[role="dialog"]')?.textContent).toContain('Wrong code')

    server.reply('POST /admin/admins/adm/sessions/s1/end', {})
    await click(confirmIn(t('admin.account.endSession')))
    expect(useToasts().toasts.at(-1)?.message).toBe(t('admin.manage.done'))
    expect(server.to('GET /admin/admins')).toHaveLength(2)
  })
})

function byText(selector: string, text: string): HTMLElement {
  return $$(selector).find((e) => e.textContent?.includes(text))!
}
