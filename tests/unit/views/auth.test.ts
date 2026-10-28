import { describe, expect, it, vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import LoginView from '@/views/LoginView.vue'
import RegisterView from '@/views/RegisterView.vue'
import ForgotPasswordView from '@/views/ForgotPasswordView.vue'
import ResetPasswordView from '@/views/ResetPasswordView.vue'
import ConfirmEmailView from '@/views/ConfirmEmailView.vue'
import ConfirmSignupView from '@/views/ConfirmSignupView.vue'
import { t } from '@/i18n'
import { useAuthStore } from '@/stores/auth'
import { useToasts } from '@/composables/useToasts'
import { TWO_FACTOR_REQUIRED } from '@/types/auth'
import { api, render, status } from '../../helpers'
import { $, button, click, field, type } from '../../dom'
import { makeUser } from '../../fixtures'

/** Submits the page's form as Enter in a field would. */
async function submit() {
  $('form')!.dispatchEvent(new Event('submit', { cancelable: true }))
  await flushPromises()
}

describe('LoginView', () => {
  it('checks the fields, signs in and goes where the guest was headed', async () => {
    const server = api({ 'POST /auth/login': { user: makeUser() } })
    const page = await render(LoginView, { path: '/login?redirect=/tasks/t-1', user: null })
    await submit()
    expect(server.to('POST /auth/login')).toHaveLength(0)
    expect(page.text()).toContain(t('validation.emailRequired'))

    await type(field(t('login.email')), 'olena@example.test')
    await type(field(t('login.password')), 'secret')
    await submit()
    expect(server.to('POST /auth/login')[0].body).toEqual({ email: 'olena@example.test', password: 'secret' })
    await vi.waitFor(() => expect(page.router.currentRoute.value.path).toBe('/tasks/t-1'))
  })

  it('asks for the two-factor code when the account needs one, and can go back', async () => {
    const server = api({ 'POST /auth/login': status(403, { error: { code: TWO_FACTOR_REQUIRED, message: 'Code needed' } }) })
    const page = await render(LoginView, { path: '/login', user: null })
    await type(field(t('login.email')), 'olena@example.test')
    await type(field(t('login.password')), 'secret')
    await submit()
    expect(page.text()).toContain(t('login.codeSubtitle', { email: 'olena@example.test' }))

    server.reply('POST /auth/login', { user: makeUser() })
    await type(field(t('login.code')), '123456')
    await submit()
    expect(server.to('POST /auth/login')[1].body).toEqual({ email: 'olena@example.test', password: 'secret', code: '123456' })
    await vi.waitFor(() => expect(page.router.currentRoute.value.path).toBe('/dashboard'))
  })

  it('shows a refused sign-in on the form', async () => {
    api({ 'POST /auth/login': status(401, { error: { code: 'BAD', message: 'Wrong email or password' } }) })
    const page = await render(LoginView, { path: '/login', user: null })
    await type(field(t('login.email')), 'olena@example.test')
    await type(field(t('login.password')), 'nope')
    await submit()
    expect(page.text()).toContain('Wrong email or password')
  })

  it('goes back from the code to the password', async () => {
    api({ 'POST /auth/login': status(403, { error: { code: TWO_FACTOR_REQUIRED, message: '' } }) })
    await render(LoginView, { path: '/login', user: null })
    await type(field(t('login.email')), 'olena@example.test')
    await type(field(t('login.password')), 'secret')
    await submit()
    await click(button(t('login.back')))
    expect(field(t('login.email')).value).toBe('olena@example.test')
    expect(field(t('login.password')).value).toBe('')
  })
})

describe('RegisterView', () => {
  it('registers, then says to check the inbox', async () => {
    const server = api({ 'POST /auth/register': { email: 'olena@example.test' } })
    const page = await render(RegisterView, { path: '/register', user: null })
    await type(field(t('register.name')), 'Olena')
    await type(field(t('login.email')), 'olena@example.test')
    await type(field(t('login.password')), 'secret2030')
    await type(field(t('register.confirmPassword')), 'secret2031')
    await submit()
    expect(page.text()).toContain(t('validation.passwordsDontMatch'))
    await type(field(t('register.confirmPassword')), 'secret2030')
    await submit()
    expect(server.to('POST /auth/register')[0].body).toMatchObject({ name: 'Olena', email: 'olena@example.test', role: 'freelancer' })
    expect(page.text()).toContain(t('register.sentTitle'))
    expect(page.text()).toContain(t('register.next.inbox.title'))
  })

  it('signs up a client, picked on the page or by the link', async () => {
    const server = api({ 'POST /auth/register': { email: 'acme@example.test' } })
    const page = await render(RegisterView, { path: '/register', user: null })
    expect(page.text()).toContain(t('register.subtitle'))
    await click(button(t('register.roles.client')))
    expect(page.text()).toContain(t('register.subtitleClient'))
    await type(field(t('register.name')), 'Acme')
    await type(field(t('login.email')), 'acme@example.test')
    await type(field(t('login.password')), 'secret2030')
    await type(field(t('register.confirmPassword')), 'secret2030')
    await submit()
    expect(server.to('POST /auth/register')[0].body).toMatchObject({ email: 'acme@example.test', role: 'client' })

    document.body.innerHTML = ''
    const linked = await render(RegisterView, { path: '/register?role=client', user: null })
    expect(linked.text()).toContain(t('register.subtitleClient'))
    expect(button(t('register.roles.client')).getAttribute('aria-pressed')).toBe('true')
  })
})

describe('ForgotPasswordView', () => {
  it('sends a reset link to the address from the link, and can try another', async () => {
    const server = api()
    const page = await render(ForgotPasswordView, { path: '/forgot-password?email=olena@example.test', user: null })
    expect(field(t('login.email')).value).toBe('olena@example.test')
    await submit()
    expect(server.to('POST /auth/password/forgot')[0].body).toEqual({ email: 'olena@example.test' })
    expect(page.text()).toContain(t('forgot.sentSubtitle', { email: 'olena@example.test' }))
    await click(button(t('forgot.tryAnother')))
    expect(page.find('form').exists()).toBe(true)
  })
})

describe('ResetPasswordView', () => {
  it('sets the new password, then sends to sign in', async () => {
    const server = api({ 'GET /me': status(401) })
    const page = await render(ResetPasswordView, { path: '/reset-password/tok', user: null })
    await type(field(t('reset.password')), 'newpass2030')
    await type(field(t('reset.confirm')), 'newpass2030')
    await submit()
    expect(server.to('POST /auth/password/reset')[0].body).toEqual({ token: 'tok', password: 'newpass2030', password_confirmation: 'newpass2030' })
    expect(useToasts().toasts.at(-1)?.message).toBe(t('reset.doneSignIn'))
    await vi.waitFor(() => expect(page.router.currentRoute.value.name).toBe('login'))
  })

  it('stays signed in on another account, going home', async () => {
    api({ 'GET /me': { user: makeUser({ id: 'other' }) } })
    const page = await render(ResetPasswordView, { path: '/reset-password/tok', user: null })
    await type(field(t('reset.password')), 'newpass2030')
    await type(field(t('reset.confirm')), 'newpass2030')
    await submit()
    expect(useToasts().toasts.at(-1)?.message).toBe(t('reset.done'))
    await vi.waitFor(() => expect(page.router.currentRoute.value.path).toBe('/dashboard'))
  })

  it('shows an expired link’s refusal', async () => {
    api({ 'POST /auth/password/reset': status(400, { error: { code: 'X', message: 'The link expired' } }) })
    const page = await render(ResetPasswordView, { path: '/reset-password/old', user: null })
    await type(field(t('reset.password')), 'newpass2030')
    await type(field(t('reset.confirm')), 'newpass2030')
    await submit()
    expect(page.text()).toContain('The link expired')
  })
})

describe('ConfirmEmailView', () => {
  it('confirms the new email, showing it at once to the signed-in account', async () => {
    const server = api({ 'POST /email-changes/confirm': { user: makeUser({ email: 'new@example.test' }) } })
    const page = await render(ConfirmEmailView, { path: '/confirm-email/tok', user: makeUser() })
    expect(server.to('POST /email-changes/confirm')[0].body).toEqual({ token: 'tok' })
    expect(page.text()).toContain(t('confirmEmail.subtitle', { email: 'new@example.test' }))
    expect(useAuthStore().user?.email).toBe('new@example.test')
    expect(page.find('a[href="/settings?tab=security"]').exists()).toBe(true)
  })

  it('says why it couldn’t, pointing a guest to sign in', async () => {
    api({ 'POST /email-changes/confirm': status(400, { error: { code: 'X', message: 'x', fields: { token: 'Already used' } } }) })
    const page = await render(ConfirmEmailView, { path: '/confirm-email/tok', user: null })
    expect(page.text()).toContain('Already used')
    expect(page.text()).toContain(t('confirmEmail.next.already.title'))
    expect(page.find('a[href="/login"]').exists()).toBe(true)

    document.body.innerHTML = ''
    vi.spyOn((await import('@/services/api')).http, 'post').mockRejectedValue(new Error('offline'))
    const offline = await render(ConfirmEmailView, { path: '/confirm-email/tok', user: makeUser() })
    expect(offline.text()).toContain(t('confirmEmail.failedGeneric'))
    expect(offline.text()).toContain(t('confirmEmail.next.keep.title'))
  })
})

describe('ConfirmSignupView', () => {
  it('creates the account and signs in', async () => {
    api({ 'POST /auth/signups/confirm': { user: makeUser() } })
    const page = await render(ConfirmSignupView, { path: '/confirm-signup/tok', user: null })
    expect(page.text()).toContain(t('confirmSignup.subtitle', { email: 'olena@example.test' }))
    expect(useAuthStore().isAuthenticated).toBe(true)
  })

  it('says a link without a token, or a refused one, didn’t work', async () => {
    const page = await render(ConfirmSignupView, { path: '/confirm-signup', user: null })
    expect(page.text()).toContain(t('confirmSignup.failedGeneric'))

    document.body.innerHTML = ''
    api({ 'POST /auth/signups/confirm': status(400, { error: { code: 'X', message: 'Expired' } }) })
    const refused = await render(ConfirmSignupView, { path: '/confirm-signup/tok', user: null })
    expect(refused.text()).toContain('Expired')
    expect(refused.text()).toContain(t('confirmSignup.next.again.title'))
  })
})
