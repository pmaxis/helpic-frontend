import { describe, expect, it, vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import InviteView from '@/views/InviteView.vue'
import JoinTeamView from '@/views/JoinTeamView.vue'
import { t } from '@/i18n'
import { useAuthStore } from '@/stores/auth'
import { useToasts } from '@/composables/useToasts'
import { TWO_FACTOR_REQUIRED } from '@/types/auth'
import { api, render, status } from '../../helpers'
import { $, field, type } from '../../dom'
import { makeUser } from '../../fixtures'

async function submit() {
  $('form')!.dispatchEvent(new Event('submit', { cancelable: true }))
  await flushPromises()
}

const lookup = (account_exists: boolean) => ({
  invitation: { email: 'acme@example.test', name: 'Acme', freelancer: { id: 'f', name: 'Olena', email: 'o@x' }, account_exists, expires_at: '2099-01-01' },
})

describe('InviteView', () => {
  it('creates a client account from the invitation and signs in', async () => {
    const server = api({ 'POST /invites/lookup': lookup(false), 'POST /invites/accept': { user: makeUser({ role: 'client' }) } })
    const page = await render(InviteView, { path: '/invite/tok', user: null })
    expect(server.to('POST /invites/lookup')[0].body).toEqual({ token: 'tok' })
    expect(page.text()).toContain(t('invite.title', { name: 'Olena' }))
    expect(field(t('invite.nameOrCompany')).value).toBe('Acme')
    await type(field(t('login.password')), 'secret2030')
    await type(field(t('register.confirmPassword')), 'secret2030')
    await submit()
    expect(server.to('POST /invites/accept')[0].body).toEqual({ token: 'tok', name: 'Acme', password: 'secret2030', password_confirmation: 'secret2030' })
    expect(useAuthStore().isClient).toBe(true)
    expect(useToasts().toasts.at(-1)?.message).toBe(t('invite.accepted', { name: 'Olena' }))
    await vi.waitFor(() => expect(page.router.currentRoute.value.path).toBe('/dashboard'))
  })

  it('signs an existing account in to accept, asking for its code when it has two-factor', async () => {
    const server = api({ 'POST /invites/lookup': lookup(true), 'POST /invites/accept': status(403, { error: { code: TWO_FACTOR_REQUIRED, message: '' } }) })
    const page = await render(InviteView, { path: '/invite/tok', user: makeUser({ email: 'someone@else' }) })
    expect(page.text()).toContain(t('invite.signedInAs', { current: 'someone@else', email: 'acme@example.test' }))
    await type(field(t('login.password')), 'secret')
    await submit()
    expect(server.to('POST /invites/accept')[0].body).toEqual({ token: 'tok', password: 'secret' })

    server.reply('POST /invites/accept', { user: makeUser({ role: 'client' }) })
    await type(field(t('login.code')), '123456')
    await submit()
    expect(server.to('POST /invites/accept')[1].body).toEqual({ token: 'tok', password: 'secret', code: '123456' })
  })

  it('says a dead link is unavailable, and a failed lookup can be tried again', async () => {
    api({ 'POST /invites/lookup': status(404, { error: { code: 'X', message: 'This invitation was revoked' } }) })
    const gone = await render(InviteView, { path: '/invite/tok', user: null })
    expect(gone.text()).toContain('This invitation was revoked')
    expect(gone.text()).toContain(t('invite.next.ask.title'))

    document.body.innerHTML = ''
    api({ 'POST /invites/lookup': status(500) })
    const failed = await render(InviteView, { path: '/invite/tok', user: null })
    expect(failed.text()).toContain(t('invite.loadFailed'))
  })
})

describe('JoinTeamView', () => {
  const invite = (role: 'member' | 'contractor', company = 'Acme') => ({
    invite: { email: 'm@x', name: 'Mo', company, role, owner: { id: 'o', name: 'Owner', email: 'o@x' }, expires_at: '2099-01-01' },
  })

  it('joins the company with a new account', async () => {
    const server = api({ 'POST /team-invites/lookup': invite('member'), 'POST /team-invites/accept': { user: makeUser({ role: 'client' }) } })
    const page = await render(JoinTeamView, { path: '/join/tok', user: null })
    expect(page.text()).toContain(t('joinTeam.title', { company: 'Acme' }))
    await type(field(t('register.name')), 'Mo Li')
    await type(field(t('login.password')), 'secret2030')
    await type(field(t('register.confirmPassword')), 'secret2030')
    await submit()
    expect(server.to('POST /team-invites/accept')[0].body).toMatchObject({ token: 'tok', name: 'Mo Li' })
    expect(useToasts().toasts.at(-1)?.message).toBe(t('joinTeam.joined', { company: 'Acme' }))
  })

  it('names an unnamed company after its owner, says what a contractor does, and warns a signed-in user', async () => {
    api({ 'POST /team-invites/lookup': invite('contractor', '') })
    const page = await render(JoinTeamView, { path: '/join/tok', user: makeUser() })
    expect(page.text()).toContain(t('joinTeam.teamOf', { name: 'Owner' }))
    expect(page.text()).toContain(t('joinTeam.subtitleContractor', { owner: 'Owner' }))
    expect(page.text()).toContain(t('joinTeam.signedInAs', { current: 'olena@example.test', email: 'm@x' }))
  })

  it('says a dead or failed link is unavailable', async () => {
    api({ 'POST /team-invites/lookup': status(404, { error: { code: 'X', message: 'Expired' } }) })
    expect((await render(JoinTeamView, { path: '/join/tok', user: null })).text()).toContain('Expired')
    document.body.innerHTML = ''
    api({ 'POST /team-invites/lookup': status(500) })
    expect((await render(JoinTeamView, { path: '/join/tok', user: null })).text()).toContain(t('invite.loadFailed'))
  })
})
