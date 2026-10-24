import { describe, expect, it } from 'vitest'
import ClientsView from '@/views/ClientsView.vue'
import FreelancersView from '@/views/FreelancersView.vue'
import TeamView from '@/views/TeamView.vue'
import { t } from '@/i18n'
import { useToasts } from '@/composables/useToasts'
import type { Team } from '@/types/team'
import { api, render, status } from '../../helpers'
import { $, $$, button, choose, click, field, type } from '../../dom'
import { makeLink, makeUser } from '../../fixtures'

const confirmIn = (label: string) => $$('[role="dialog"] button').find((b) => b.textContent?.trim() === label)!

describe('ClientsView', () => {
  const invitation = (id: string, expired = false) => ({ id, email: `${id}@x`, name: id, expired, expires_at: '2099-01-01', created_at: '2030-01-01' })

  it('lists the clients and the pending invitations', async () => {
    api({ 'GET /clients': { clients: [makeLink({ open_tasks: 2 })] }, 'GET /invitations': { invitations: [invitation('new'), invitation('old', true)] } })
    const page = await render(ClientsView, { path: '/clients', user: makeUser() })
    expect(page.text()).toContain('Acme')
    expect(page.text()).toContain(t('people.openTasks', { n: 2 }, 2))
    expect(page.text()).toContain(t('clients.pending'))
    expect(page.text()).toContain(t('clients.expired'))
  })

  it('invites a client by email, confirming it was sent', async () => {
    const server = api({ 'GET /clients': { clients: [] }, 'GET /invitations': { invitations: [] }, 'POST /invitations': { invitation: invitation('acme') } })
    const page = await render(ClientsView, { path: '/clients', user: makeUser() })
    expect(page.text()).toContain(t('clients.noneYet'))
    await click(button(t('clients.invite')))
    await type(field(t('inviteModal.name')), 'Acme')
    await type(field(t('inviteModal.email')), 'acme@example.test')
    await click(button(t('inviteModal.create')))
    expect(server.to('POST /invitations')[0].body).toEqual({ name: 'Acme', email: 'acme@example.test' })
    expect($('[role="dialog"]')?.textContent).toContain(t('inviteModal.emailed', { email: 'acme@example.test' }))
  })

  it('revokes an invitation after asking, saying when it can’t', async () => {
    const server = api({ 'GET /clients': { clients: [] }, 'GET /invitations': { invitations: [invitation('a'), invitation('b')] } })
    await render(ClientsView, { path: '/clients', user: makeUser() })
    await click($$('button').filter((b) => b.textContent?.trim() === t('clients.revoke'))[0])
    await click(confirmIn(t('clients.revoke')))
    expect(server.to('DELETE /invitations/a')).toHaveLength(1)
    expect(useToasts().toasts.at(-1)?.message).toBe(t('clients.revoked'))

    server.reply('DELETE /invitations/b', status(500))
    await click($$('button').filter((b) => b.textContent?.trim() === t('clients.revoke'))[0])
    await click(confirmIn(t('clients.revoke')))
    expect(useToasts().toasts.at(-1)?.message).toBe(t('clients.revokeFailed'))
  })

  it('says when the clients can’t load', async () => {
    api({ 'GET /clients': status(500) })
    await render(ClientsView, { path: '/clients', user: makeUser() })
    expect(useToasts().toasts.at(-1)?.message).toBe(t('clients.loadFailed'))
  })
})

describe('FreelancersView', () => {
  it('lists a client’s freelancers, or says there are none yet', async () => {
    api({ 'GET /freelancers': { freelancers: [makeLink({ id: 'f', name: 'Fay Lee' })] } })
    const page = await render(FreelancersView, { path: '/freelancers', user: makeUser({ role: 'client' }) })
    expect(page.text()).toContain('Fay Lee')
    expect(page.text()).toContain('FL')

    document.body.innerHTML = ''
    api({ 'GET /freelancers': { freelancers: [] } })
    expect((await render(FreelancersView, { path: '/freelancers', user: makeUser({ role: 'client' }) })).text()).toContain(t('freelancers.noneYet'))

    api({ 'GET /freelancers': status(500) })
    await render(FreelancersView, { path: '/freelancers', user: makeUser({ role: 'client' }) })
    expect(useToasts().toasts.at(-1)?.message).toBe(t('freelancers.loadFailed'))
  })
})

describe('TeamView', () => {
  const owner = makeUser({ id: 'u-client', role: 'client', name: 'Acme' })
  const team = (over: Partial<Team> = {}): Team => ({
    role: 'owner',
    name: 'Acme Inc',
    owner: { id: 'u-client', name: 'Acme', email: 'acme@x' },
    members: [{ id: 'm1', name: 'Mo', email: 'mo@x', role: 'member', joined_at: '2030-01-01' }],
    invites: [{ id: 'i1', email: 'new@x', name: '', role: 'contractor', expired: false, expires_at: '2099-01-01', created_at: '2030-01-01' }],
    ...over,
  })

  it('renames the company once the name changed', async () => {
    const server = api({ 'GET /team': { team: team() }, 'PUT /team': { team: team({ name: 'Acme Ltd' }) } })
    await render(TeamView, { path: '/team', user: owner })
    expect(field(t('team.companyName')).value).toBe('Acme Inc')
    await type(field(t('team.companyName')), 'Acme Ltd')
    await click(button(t('common.save')))
    expect(server.to('PUT /team')[0].body).toEqual({ name: 'Acme Ltd' })
    expect(useToasts().toasts.at(-1)?.message).toBe(t('team.nameSaved'))
  })

  it('invites someone as a contractor, listing the invitation', async () => {
    const server = api({
      'GET /team': { team: team({ invites: [] }) },
      'POST /team/invites': { invite: { id: 'i2', email: 'cy@example.test', name: 'Cy', role: 'contractor', expired: false, expires_at: '2099-01-01', created_at: '2030-01-01' } },
    })
    const page = await render(TeamView, { path: '/team?tab=invite', user: owner })
    await type(field(t('team.email')), 'cy@example.test')
    await type(field(t('team.name')), 'Cy')
    await choose(t('team.role'), t('team.roles.contractor'))
    // the form's own button, not the tab of the same name
    await click($$('form button').find((b) => b.textContent?.trim() === t('team.invite'))!)
    expect(server.to('POST /team/invites')[0].body).toEqual({ email: 'cy@example.test', name: 'Cy', role: 'contractor' })
    expect(useToasts().toasts.at(-1)?.message).toBe(t('team.emailed', { email: 'cy@example.test' }))
    expect(page.text()).toContain('cy@example.test')
  })

  it('revokes an invitation, changes a member’s role and removes them', async () => {
    const server = api({ 'GET /team': { team: team() }, 'PUT /team/members/m1': { team: team({ members: [{ id: 'm1', name: 'Mo', email: 'mo@x', role: 'contractor', joined_at: '2030-01-01' }] }) } })
    const page = await render(TeamView, { path: '/team?tab=invite', user: owner })
    await click(button(t('team.revoke')))
    await click(confirmIn(t('team.revoke')))
    expect(server.to('DELETE /team/invites/i1')).toHaveLength(1)
    expect(page.text()).not.toContain('new@x')

    await click($$('nav button').find((b) => b.textContent?.includes(t('team.tabs.members')))!)
    await choose(t('team.roleFor', { name: 'Mo' }), t('team.roles.contractor'))
    expect(server.to('PUT /team/members/m1')[0].body).toEqual({ role: 'contractor' })
    expect(useToasts().toasts.at(-1)?.message).toBe(t('team.roleChanged', { name: 'Mo', role: t('team.roles.contractor').toLowerCase() }))

    await click(button(t('team.remove')))
    await click(confirmIn(t('team.remove')))
    expect(server.to('DELETE /team/members/m1')).toHaveLength(1)
    expect(page.text()).toContain(t('team.noMembers'))
  })

  it('says when a change fails', async () => {
    api({ 'GET /team': { team: team() }, 'PUT /team/members/m1': status(500), 'DELETE /team/members/m1': status(500), 'DELETE /team/invites/i1': status(500) })
    await render(TeamView, { path: '/team?tab=members', user: owner })
    await choose(t('team.roleFor', { name: 'Mo' }), t('team.roles.contractor'))
    expect(useToasts().toasts.at(-1)?.message).toBe(t('team.roleFailed'))
    await click(button(t('team.remove')))
    await click(confirmIn(t('team.remove')))
    expect(useToasts().toasts.at(-1)?.message).toBe(t('team.removeFailed'))
    await click($$('nav button').find((b) => b.textContent?.includes(t('team.tabs.invite')))!)
    await click(button(t('team.revoke')))
    await click(confirmIn(t('team.revoke')))
    expect(useToasts().toasts.at(-1)?.message).toBe(t('team.revokeFailed'))
  })

  it('shows a member whose team it is, and says when it can’t load', async () => {
    api({ 'GET /team': { team: team({ role: 'contractor', members: undefined, invites: undefined }) } })
    const page = await render(TeamView, { path: '/team', user: makeUser({ role: 'client', member_of: { owner_id: 'u-client', name: 'Acme', role: 'contractor' } }) })
    expect(page.text()).toContain(t('team.runBy', { name: 'Acme' }))
    expect(page.text()).toContain(t('team.contractorText').slice(0, 30))

    document.body.innerHTML = ''
    api({ 'GET /team': status(500) })
    expect((await render(TeamView, { path: '/team', user: owner })).text()).toContain(t('team.loadFailed'))
  })
})
