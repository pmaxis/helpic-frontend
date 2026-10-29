import { afterEach, describe, expect, it, vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import SettingsView from '@/views/SettingsView.vue'
import { t, currentLocale } from '@/i18n'
import { useAuthStore } from '@/stores/auth'
import { useToasts } from '@/composables/useToasts'
import { useTheme } from '@/composables/useTheme'
import type { Session } from '@/types/auth'
import { api, render, status, type Reply } from '../../helpers'
import { $, $$, button, choose, click, field, press, type } from '../../dom'
import { makeUser } from '../../fixtures'

const MAC = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Chrome/130.0 Safari/537.36'
const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Version/17.0 Mobile/15E148 Safari/604.1'

const session = (over: Partial<Session> = {}): Session =>
  ({ id: 's1', user_agent: MAC, ip: '10.0.0.1', current: true, created_at: '2030-01-01T00:00:00Z', last_used_at: new Date().toISOString(), ...over }) as Session

function serve(extra: Record<string, Reply> = {}) {
  return api({
    'GET /me/sessions': { sessions: [session(), session({ id: 's2', user_agent: IPHONE, current: false, ip: '' }), session({ id: 's3', current: false, last_used_at: '2030-01-01T00:00:00Z' })] },
    'GET /me/two-factor': { enabled: false, recovery_codes_left: 0 },
    'GET /me/app-notifications': { app_notifications: { kinds: ['task_created', 'comment_added'], available: ['task_created', 'comment_added', 'report_paid'], default_kinds: [] } },
    'GET /me/email-notifications': { email_notifications: { kinds: ['task_created'], available: ['task_created', 'comment_added', 'report_paid'], default_kinds: [] } },
    'GET /me/telegram': { telegram: { enabled: true, connected: false, username: '', kinds: [], linked_at: null, available: ['task_created'], default_kinds: [] } },
    ...extra,
  })
}

const freelancer = () => makeUser({ hourly_rate_cents: 4000 })

afterEach(() => {
  useToasts().toasts.splice(0)
  vi.useRealTimers()
})

describe('Settings › Profile', () => {
  it('saves the name once it changed, and resets it', async () => {
    const server = serve({ 'PUT /me': { user: makeUser({ first_name: 'Ola' }) } })
    await render(SettingsView, { path: '/settings', user: freelancer() })
    expect(() => button(t('common.save'))).toThrow()
    await type(field(t('settings.profile.firstName')), 'Ola')
    await click(button(t('common.cancel')))
    expect(field(t('settings.profile.firstName')).value).toBe('Olena')
    await type(field(t('settings.profile.firstName')), 'Ola')
    await click(button(t('common.save')))
    expect(server.to('PUT /me')[0].body).toEqual({ first_name: 'Ola', last_name: 'Freelancer' })
    expect(useToasts().toasts.at(-1)?.message).toBe(t('settings.profile.nameUpdated'))
  })

  it('names the account’s role, a team member’s company too', async () => {
    serve()
    const page = await render(SettingsView, { path: '/settings', user: makeUser({ role: 'client', member_of: { owner_id: 'o', name: 'Acme', role: 'member' } }) })
    expect(page.text()).toContain('Acme')
    expect(page.text()).toContain(t('settings.profile.firstNameOrCompany'))
  })

  it('switches the language, the theme and the currency', async () => {
    const server = serve({ 'PUT /me/locale': { user: makeUser({ locale: 'uk' }) }, 'PUT /me/currency': { user: makeUser({ currency: 'EUR' }) } })
    await render(SettingsView, { path: '/settings', user: freelancer() })
    await choose(t('settings.profile.currency'), 'EUR')
    expect(server.to('PUT /me/currency')[0].body).toEqual({ currency: 'EUR' })
    await choose(t('settings.groups.theme'), t('settings.groups.themes.dark'))
    expect(useTheme().theme.value).toBe('dark')
    useTheme().theme.value = 'system'
    await choose(t('common.language'), 'Українська')
    expect(currentLocale()).toBe('uk')
  })

  it('says why a currency or language change failed', async () => {
    serve({ 'PUT /me/currency': status(422, { error: { code: 'V', message: 'x', fields: { currency: 'Has sent reports' } } }), 'PUT /me/locale': status(500) })
    await render(SettingsView, { path: '/settings', user: freelancer() })
    await choose(t('settings.profile.currency'), 'EUR')
    expect(useToasts().toasts.at(-1)?.message).toBe('Has sent reports')
    await choose(t('common.language'), 'Українська')
    expect(useToasts().toasts.at(-1)?.message).toBe('Error 500')
  })

  it('saves the hourly rate on Enter, once, showing a refusal under it', async () => {
    const server = serve({ 'PUT /me/rate': status(422, { error: { code: 'V', message: 'x', fields: { rate: 'Too high' } } }) })
    const page = await render(SettingsView, { path: '/settings', user: freelancer() })
    const rate = field(t('timelog.rate'))
    expect(rate.value).toBe('40')
    await type(rate, '45')
    await press('Enter', rate)
    rate.dispatchEvent(new Event('blur'))
    await flushPromises()
    expect(server.to('PUT /me/rate')).toHaveLength(1)
    expect(page.text()).toContain('Too high')

    server.reply('PUT /me/rate', { user: makeUser({ hourly_rate_cents: null }) })
    await type(rate, '')
    rate.dispatchEvent(new Event('blur'))
    await flushPromises()
    expect(server.to('PUT /me/rate')[1].body).toEqual({ rate: null })
  })
})

describe('Settings › Security', () => {
  it('keeps the open tab in the URL, old links landing on security', async () => {
    serve()
    const page = await render(SettingsView, { path: '/settings?tab=password', user: freelancer() })
    expect(page.text()).toContain(t('settings.password.title'))
    await click(byTab(t('settings.tabs.notifications')))
    expect(page.router.currentRoute.value.query.tab).toBe('notifications')
    await click(byTab(t('settings.tabs.profile')))
    expect(page.router.currentRoute.value.query.tab).toBeUndefined()
  })

  it('changes the email once the current password confirms it', async () => {
    const server = serve({ 'PUT /me/email': { pending_email: 'new@example.test' } })
    const page = await render(SettingsView, { path: '/settings?tab=security', user: freelancer() })
    await click(button(t('settings.groups.change')))
    await type(field(t('settings.groups.newEmail')), 'new@example.test')
    await click(button(t('settings.email.change')))
    await type(field(t('settings.confirmPassword.label')), 'secret')
    await click($$('[role="dialog"] button').find((b) => b.textContent?.includes(t('settings.email.change')))!)
    expect(server.to('PUT /me/email')[0].body).toEqual({ email: 'new@example.test', current_password: 'secret' })
    expect(page.text()).toContain('new@example.test')
  })

  it('hands a refusal of the email back to its field, a wrong password staying in the modal', async () => {
    const server = serve({ 'PUT /me/email': status(422, { error: { code: 'V', message: 'x', fields: { email: 'Taken' } } }) })
    const page = await render(SettingsView, { path: '/settings?tab=security', user: freelancer() })
    await click(button(t('settings.groups.change')))
    await type(field(t('settings.groups.newEmail')), 'taken@example.test')
    await click(button(t('settings.email.change')))
    await type(field(t('settings.confirmPassword.label')), 'secret')
    await click($$('[role="dialog"] button').find((b) => b.textContent?.includes(t('settings.email.change')))!)
    expect($('[role="dialog"]')).toBeNull()
    expect(page.text()).toContain('Taken')

    server.reply('PUT /me/email', status(422, { error: { code: 'V', message: 'x', fields: { current_password: 'Wrong password' } } }))
    await click(button(t('settings.email.change')))
    await type(field(t('settings.confirmPassword.label')), 'nope')
    await click($$('[role="dialog"] button').find((b) => b.textContent?.includes(t('settings.email.change')))!)
    expect($('[role="dialog"]')?.textContent).toContain('Wrong password')
    await click($$('[role="dialog"] button').find((b) => b.textContent?.includes(t('common.cancel')))!)
    expect($('[role="dialog"]')).toBeNull()
  })

  it('changes the password, checking the new one first', async () => {
    const server = serve({ 'PUT /me/password': {} })
    await render(SettingsView, { path: '/settings?tab=security', user: freelancer() })
    await click($$('button').filter((b) => b.textContent?.includes(t('settings.groups.change')))[1])
    await type(field(t('settings.password.new')), 'newpass2030')
    await type(field(t('settings.password.confirm')), 'different2030')
    await click(button(t('settings.password.change')))
    expect($('[role="dialog"]')).toBeNull()
    await type(field(t('settings.password.confirm')), 'newpass2030')
    await click(button(t('settings.password.change')))
    await type(field(t('settings.confirmPassword.label')), 'old')
    await click($$('[role="dialog"] button').find((b) => b.textContent?.includes(t('settings.password.change')))!)
    expect(server.to('PUT /me/password')[0].body).toEqual({ current_password: 'old', password: 'newpass2030', password_confirmation: 'newpass2030' })
    expect(useToasts().toasts.at(-1)?.message).toBe(t('settings.password.changed'))
  })

  it('hands a refused new password back to its field', async () => {
    serve({ 'PUT /me/password': status(422, { error: { code: 'V', message: 'x', fields: { password: 'Too common' } } }) })
    const page = await render(SettingsView, { path: '/settings?tab=security', user: freelancer() })
    await click($$('button').filter((b) => b.textContent?.includes(t('settings.groups.change')))[1])
    await type(field(t('settings.password.new')), 'password1')
    await type(field(t('settings.password.confirm')), 'password1')
    await click(button(t('settings.password.change')))
    await type(field(t('settings.confirmPassword.label')), 'old')
    await click($$('[role="dialog"] button').find((b) => b.textContent?.includes(t('settings.password.change')))!)
    expect(page.text()).toContain('Too common')
  })

  it('lists the devices, this one first, and signs one or all of the others out', async () => {
    const server = serve()
    const page = await render(SettingsView, { path: '/settings?tab=security', user: freelancer() })
    expect(page.text()).toContain(t('settings.sessions.thisDevice'))
    expect(page.text()).toContain('Safari on iOS')
    expect(page.text()).toContain(t('settings.sessions.activeRecently'))
    await click($$('button').find((b) => b.textContent?.trim() === t('settings.sessions.signOut'))!)
    expect(server.to('DELETE /me/sessions/s2')).toHaveLength(1)

    server.reply('GET /me/sessions', { sessions: [session(), session({ id: 's2', current: false }), session({ id: 's3', current: false })] })
    await click(byTab(t('settings.tabs.profile')))
    await click(byTab(t('settings.tabs.security')))
    await click(button(t('settings.sessions.signOutAll')))
    await click($$('[role="dialog"] button').find((b) => b.textContent?.includes(t('settings.sessions.signOut')))!)
    expect(server.to('DELETE /me/sessions')).toHaveLength(1)
    expect(page.text()).toContain(t('settings.sessions.onlyHere'))
  })

  it('says when the devices can’t load or be signed out', async () => {
    serve({ 'GET /me/sessions': status(500) })
    await render(SettingsView, { path: '/settings?tab=security', user: freelancer() })
    expect(useToasts().toasts.some((x) => x.message === t('settings.sessions.loadFailed'))).toBe(true)
  })

  it('turns two-factor on: password, QR code, first code, recovery codes', async () => {
    const server = serve({
      'POST /me/two-factor/setup': { secret: 'ABCDEFGHIJKL', uri: 'otpauth://x', qr: 'data:image/png;base64,AA' },
      'POST /me/two-factor/enable': { user: makeUser({ two_factor: true }), recovery_codes: ['aaaa-1111', 'bbbb-2222'] },
    })
    const page = await render(SettingsView, { path: '/settings?tab=security', user: freelancer() })
    await click(button(t('settings.twoFactor.turnOn')))
    await type(field(t('settings.confirmPassword.label')), 'secret')
    await click($$('[role="dialog"] button').find((b) => b.textContent?.includes(t('settings.twoFactor.continue')))!)
    expect(page.text()).toContain('ABCD EFGH IJKL')
    expect($('img')?.getAttribute('src')).toContain('data:image/png')

    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.assign(navigator, { clipboard: { writeText } })
    await click(button(t('settings.twoFactor.copy')))
    expect(writeText).toHaveBeenCalledWith('ABCDEFGHIJKL')

    await type(field(t('settings.twoFactor.code')), '123456')
    await page.get('[data-two-factor-setup]').trigger('submit')
    await flushPromises()
    expect(server.to('POST /me/two-factor/enable')[0].body).toEqual({ code: '123456' })
    expect(page.text()).toContain('aaaa-1111')
    expect(useAuthStore().user?.two_factor).toBe(true)
    expect(server.to('GET /me/sessions')).toHaveLength(2)

    URL.createObjectURL = vi.fn(() => 'blob:codes')
    URL.revokeObjectURL = vi.fn()
    const download = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    await click(button(t('settings.twoFactor.download')))
    expect(download).toHaveBeenCalled()
    await click(button(t('settings.twoFactor.saved')))
    expect(page.text()).not.toContain('aaaa-1111')
  })

  it('makes new recovery codes and turns two-factor off, each with a code', async () => {
    const server = serve({
      'GET /me/two-factor': { enabled: true, recovery_codes_left: 2 },
      'POST /me/two-factor/recovery-codes': { recovery_codes: ['cccc-3333'] },
      'POST /me/two-factor/disable': { user: makeUser({ two_factor: false }) },
    })
    const page = await render(SettingsView, { path: '/settings?tab=security', user: makeUser({ two_factor: true }) })
    expect(page.text()).toContain(t('settings.twoFactor.recoveryLow', { n: 2 }))

    await click(button(t('settings.twoFactor.newCodes')))
    await type(field(t('settings.confirmPassword.label')), 'pw')
    await type(field(t('settings.twoFactor.codeOrRecovery')), '111111')
    await click($$('[role="dialog"] button').at(-1)!)
    expect(server.to('POST /me/two-factor/recovery-codes')[0].body).toEqual({ current_password: 'pw', code: '111111' })
    expect(page.text()).toContain('cccc-3333')

    await click(button(t('settings.twoFactor.turnOff')))
    await type(field(t('settings.confirmPassword.label')), 'pw')
    await type(field(t('settings.twoFactor.codeOrRecovery')), '222222')
    await click($$('[role="dialog"] button').at(-1)!)
    expect(server.to('POST /me/two-factor/disable')).toHaveLength(1)
    expect(useToasts().toasts.at(-1)?.message).toBe(t('settings.twoFactor.disabled'))
  })

  it('says why two-factor can’t be set up, and when it can’t load', async () => {
    // Anything the API says about the change itself, not the password, comes with its fields.
    serve({ 'POST /me/two-factor/setup': status(409, { error: { code: 'X', message: 'Already on', fields: { two_factor: 'on' } } }) })
    await render(SettingsView, { path: '/settings?tab=security', user: freelancer() })
    await click(button(t('settings.twoFactor.turnOn')))
    await type(field(t('settings.confirmPassword.label')), 'secret')
    await click($$('[role="dialog"] button').find((b) => b.textContent?.includes(t('settings.twoFactor.continue')))!)
    expect(useToasts().toasts.at(-1)?.message).toBe('Already on')

    document.body.innerHTML = ''
    serve({ 'GET /me/two-factor': status(500) })
    const page = await render(SettingsView, { path: '/settings?tab=security', user: freelancer() })
    expect(page.text()).toContain(t('settings.twoFactor.loadFailed'))
  })
})

describe('Settings › Delete account', () => {
  const confirmButton = () => $$('[role="dialog"] button').find((b) => b.textContent?.includes(t('settings.deleteAccount.action')))!

  it('deletes the account with the password, then goes to sign in', async () => {
    const server = serve({ 'DELETE /me': status(422, { error: { code: 'V', message: 'x', fields: { current_password: 'Wrong password' } } }) })
    const page = await render(SettingsView, { path: '/settings?tab=security', user: freelancer() })
    expect($('[role="dialog"]')).toBeNull()
    await click(button(t('settings.deleteAccount.open')))
    expect(() => field(t('settings.twoFactor.codeOrRecovery'))).toThrow()
    await type(field(t('settings.confirmPassword.label')), 'nope')
    await click(confirmButton())
    expect($('[role="dialog"]')?.textContent).toContain('Wrong password')

    server.reply('DELETE /me', {})
    await type(field(t('settings.confirmPassword.label')), 'secret')
    await click(confirmButton())
    await vi.waitFor(() => expect(page.router.currentRoute.value.name).toBe('login'))
    expect(server.to('DELETE /me').at(-1)?.body).toEqual({ current_password: 'secret' })
    expect(useAuthStore().user).toBeNull()
    expect(useToasts().toasts.at(-1)?.message).toBe(t('settings.deleteAccount.done'))
  })

  it('asks for a code with two-factor on, and says why it was refused', async () => {
    const server = serve({
      'GET /me/two-factor': { enabled: true, recovery_codes_left: 10 },
      'DELETE /me': status(409, { error: { code: 'CONFLICT', message: 'Your company still has people in it.' } }),
    })
    await render(SettingsView, { path: '/settings?tab=security', user: makeUser({ role: 'client', two_factor: true }) })
    await click(button(t('settings.deleteAccount.open')))
    await type(field(t('settings.confirmPassword.label')), 'pw')
    await type(field(t('settings.twoFactor.codeOrRecovery')), '123456')
    await click(confirmButton())
    expect(server.to('DELETE /me')[0].body).toEqual({ current_password: 'pw', code: '123456' })
    expect($('[role="dialog"]')?.textContent).toContain('Your company still has people in it.')
    expect(useAuthStore().user).not.toBeNull()
  })

  it('isn’t offered to an admin', async () => {
    serve()
    await render(SettingsView, { path: '/settings?tab=security', user: makeUser({ role: 'admin' }) })
    expect(() => button(t('settings.deleteAccount.open'))).toThrow()
  })
})

describe('Settings › Notifications', () => {
  it('switches the emailed kinds, only those this user can get, and turns email off', async () => {
    const server = serve({ 'PUT /me/email-notifications': (c: { body: { kinds: string[] } }) => ({ email_notifications: { kinds: c.body.kinds, available: ['task_created', 'comment_added', 'report_paid'], default_kinds: [] } }) })
    const page = await render(SettingsView, { path: '/settings?tab=notifications', user: makeUser({ role: 'client', member_of: { owner_id: 'o', name: 'Acme', role: 'member' } }) })
    // a team member never gets "report paid": it's for the report's two sides
    expect(page.text()).not.toContain(t('notificationKinds.report_paid'))
    await click(sw('comment_added', 'email'))
    expect(server.to('PUT /me/email-notifications')[0].body).toEqual({ kinds: ['task_created', 'comment_added'] })

    // The first row turns the whole channel off, and back on to its defaults.
    await click(all('email'))
    expect(server.to('PUT /me/email-notifications')[1].body).toEqual({ kinds: [] })
    expect(sw('comment_added', 'email').getAttribute('aria-checked')).toBe('false')
    expect(all('email').getAttribute('aria-checked')).toBe('false')
    expect(page.text()).toContain('olena@example.test')
  })

  it('turns every channel off and on from the first row, Telegram once connected', async () => {
    const server = serve({
      'PUT /me/app-notifications': (c: { body: { kinds: string[] } }) => ({ app_notifications: { kinds: c.body.kinds, available: ['task_created', 'comment_added'], default_kinds: ['task_created', 'comment_added'] } }),
    })
    await render(SettingsView, { path: '/settings?tab=notifications', user: makeUser() })
    await click(all('app'))
    expect(server.to('PUT /me/app-notifications')[0].body).toEqual({ kinds: [] })
    await click(all('app'))
    expect(server.to('PUT /me/app-notifications')[1].body).toEqual({ kinds: ['task_created', 'comment_added'] })
    // not connected: nothing to switch
    expect(all('telegram').hasAttribute('disabled')).toBe(true)
  })

  it('switches what the bell shows', async () => {
    const server = serve({ 'PUT /me/app-notifications': (c: { body: { kinds: string[] } }) => ({ app_notifications: { kinds: c.body.kinds, available: ['task_created', 'comment_added', 'report_paid'], default_kinds: [] } }) })
    await render(SettingsView, { path: '/settings?tab=notifications', user: makeUser() })
    expect(sw('comment_added', 'app').getAttribute('aria-checked')).toBe('true')
    await click(sw('comment_added', 'app'))
    expect(server.to('PUT /me/app-notifications')[0].body).toEqual({ kinds: ['task_created'] })
    expect(sw('comment_added', 'app').getAttribute('aria-checked')).toBe('false')
  })

  it('puts a refused choice back', async () => {
    serve({ 'PUT /me/email-notifications': status(500, { error: { code: 'X', message: 'Nope' } }) })
    await render(SettingsView, { path: '/settings?tab=notifications', user: makeUser() })
    await click(all('email'))
    expect(useToasts().toasts.at(-1)?.message).toBe('Nope')
    expect(all('email').getAttribute('aria-checked')).toBe('true')
  })

  it('connects Telegram through a one-time link, waiting for the bot', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] })
    const server = serve({ 'POST /me/telegram/link': { link: { url: 'https://t.me/helpic_bot?start=x', expires_at: '2099-01-01T00:00:00Z' } } })
    const tab = { opener: {}, location: { href: '' }, close: vi.fn() }
    vi.spyOn(window, 'open').mockReturnValue(tab as never)
    const page = await render(SettingsView, { path: '/settings?tab=integrations', user: makeUser() })
    expect(page.text()).toContain(t('integrations.telegram.does.reply'))
    await click(button(t('notificationSettings.telegram.connect')))
    expect(tab.location.href).toBe('https://t.me/helpic_bot?start=x')
    expect(tab.opener).toBeNull()

    server.reply('GET /me/telegram', { telegram: { enabled: true, connected: true, username: 'olena', kinds: ['task_created'], linked_at: '2030-01-01T00:00:00Z', available: ['task_created'], default_kinds: [] } })
    vi.advanceTimersByTime(2500)
    await flushPromises()
    expect(page.text()).toContain(t('notificationSettings.telegram.as', { name: 'olena' }))
    expect(useToasts().toasts.at(-1)?.message).toBe(t('notificationSettings.telegram.connectedToast'))
    // Which kinds go there is picked under Notifications.
    await click(byLink(t('integrations.telegram.toNotifications')))
    await flushPromises()
    expect(page.router.currentRoute.value.query.tab).toBe('notifications')
  })

  it('gives up on an expired link, and closes the tab when no link comes', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] })
    const server = serve({ 'POST /me/telegram/link': { link: { url: 'https://t.me/x', expires_at: '2000-01-01T00:00:00Z' } } })
    vi.spyOn(window, 'open').mockReturnValue(null)
    await render(SettingsView, { path: '/settings?tab=integrations', user: makeUser() })
    await click(button(t('notificationSettings.telegram.connect')))
    window.dispatchEvent(new Event('focus'))
    await flushPromises()
    expect(useToasts().toasts.at(-1)?.message).toBe(t('notificationSettings.telegram.expired'))

    const tab = { opener: {}, location: { href: '' }, close: vi.fn() }
    vi.spyOn(window, 'open').mockReturnValue(tab as never)
    server.reply('POST /me/telegram/link', status(503, { error: { code: 'X', message: 'Bot down' } }))
    await click(button(t('notificationSettings.telegram.connect')))
    expect(tab.close).toHaveBeenCalled()
    expect(useToasts().toasts.at(-1)?.message).toBe('Bot down')
  })

  it('switches what goes to a connected chat, and disconnects it', async () => {
    const connected = { enabled: true, connected: true, username: 'olena', kinds: [], linked_at: '2030-01-01T00:00:00Z', available: ['task_created'], default_kinds: [] }
    const server = serve({
      'GET /me/telegram': { telegram: connected },
      'PUT /me/telegram/kinds': { telegram: { ...connected, kinds: ['task_created'] } },
      'DELETE /me/telegram': {},
    })
    const page = await render(SettingsView, { path: '/settings?tab=notifications', user: makeUser() })
    expect(page.text()).toContain('olena')
    await click(sw('task_created', 'telegram'))
    expect(server.to('PUT /me/telegram/kinds')[0].body).toEqual({ kinds: ['task_created'] })
    expect(page.text()).not.toContain(t('notificationSettings.telegram.disconnect'))

    // The bot is disconnected under Integrations.
    await click(byTab(t('settings.tabs.integrations')))
    await flushPromises()
    server.reply('GET /me/telegram', { telegram: { ...connected, connected: false } })
    await click(button(t('notificationSettings.telegram.disconnect')))
    expect(server.to('DELETE /me/telegram')).toHaveLength(1)
    expect(page.text()).toContain(t('notificationSettings.telegram.connect'))
  })

  it('points to Integrations from Notifications while the bot isn’t connected', async () => {
    serve()
    const page = await render(SettingsView, { path: '/settings?tab=notifications', user: makeUser() })
    // the column is there, waiting, switched off
    const telegram = sw('task_created', 'telegram')
    expect(telegram.hasAttribute('disabled')).toBe(true)
    expect(telegram.getAttribute('aria-checked')).toBe('false')
    await click(`a[aria-label="${t('notificationSettings.telegram.toIntegrations')}"]`)
    await flushPromises()
    expect(page.router.currentRoute.value.query.tab).toBe('integrations')
  })

  it('says Telegram isn’t set up on a server without a bot', async () => {
    serve({ 'GET /me/telegram': { telegram: { enabled: false, connected: false, username: '', kinds: [], linked_at: null, available: [], default_kinds: [] } } })
    const page = await render(SettingsView, { path: '/settings?tab=notifications', user: makeUser() })
    expect($$('[role="columnheader"]').map((h) => h.textContent)).not.toContainEqual(expect.stringContaining(t('notificationSettings.telegram.title')))
    expect(() => sw('task_created', 'email')).not.toThrow()
    await click(byTab(t('settings.tabs.integrations')))
    await flushPromises()
    expect(page.text()).toContain(t('notificationSettings.telegram.notSetUp'))
  })

  it('has no notifications or integrations tab for an admin', async () => {
    serve()
    const page = await render(SettingsView, { path: '/settings?tab=integrations', user: makeUser({ role: 'admin' }) })
    expect($$('nav button').map((b) => b.textContent?.trim())).not.toContain(t('settings.tabs.notifications'))
    expect($$('nav button').map((b) => b.textContent?.trim())).not.toContain(t('settings.tabs.integrations'))
    expect(page.text()).toContain(t('settings.groups.profile'))
  })
})

function byTab(label: string): HTMLElement {
  return $$('nav button').find((b) => b.textContent?.trim() === label)!
}


function byLink(text: string): HTMLElement {
  return $$('a').find((a) => a.textContent?.trim() === text)!
}

/** The switch for a kind of notification in a channel's column. */
function sw(kind: string, channel: 'app' | 'email' | 'telegram'): HTMLElement {
  const label = t('notificationSettings.inChannel', { kind: t(`notificationKinds.${kind}`), channel: t(`notificationSettings.${channel}.title`) })
  const el = $(`[role="switch"][aria-label="${label}"]`)
  if (!el) throw new Error(`no switch: ${label}`)
  return el
}

/** The switch for a whole channel, in the first row. */
function all(channel: 'app' | 'email' | 'telegram'): HTMLElement {
  const label = t('notificationSettings.allIn', { channel: t(`notificationSettings.${channel}.title`) })
  const el = $(`[role="switch"][aria-label="${label}"]`)
  if (!el) throw new Error(`no switch: ${label}`)
  return el
}
