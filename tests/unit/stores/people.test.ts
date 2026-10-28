import { describe, expect, it, vi } from 'vitest'
import { http } from '@/services/api'
import { usePeopleStore } from '@/stores/people'
import type { Invitation } from '@/types/people'
import { makeLink, makeUser } from '../../fixtures'

const invitation = (over: Partial<Invitation> = {}) => ({ id: 'inv-1', email: 'new@example.test', ...over }) as Invitation

describe('people store', () => {
  it('loads the clients and the invitations together', async () => {
    const people = usePeopleStore()
    vi.spyOn(http, 'get').mockImplementation(async (url: string) =>
      url === '/clients' ? { data: { clients: [makeLink()] } } : { data: { invitations: [invitation()] } },
    )
    await people.fetchClients()
    expect([people.clients.length, people.invitations.length]).toEqual([1, 1])
  })

  it('puts a new invitation first, replacing an older one to the same address', async () => {
    const people = usePeopleStore()
    people.invitations = [invitation({ id: 'old' }), invitation({ id: 'other', email: 'x@example.test' })]
    vi.spyOn(http, 'post').mockResolvedValue({ data: { invitation: invitation({ id: 'fresh' }) } })
    await people.invite({ email: 'new@example.test' } as never)
    expect(people.invitations.map((i) => i.id)).toEqual(['fresh', 'other'])
  })

  it('revokes an invitation', async () => {
    const people = usePeopleStore()
    people.invitations = [invitation()]
    vi.spyOn(http, 'delete').mockResolvedValue({ data: {} })
    await people.revokeInvitation('inv-1')
    expect(people.invitations).toEqual([])
  })

  it('loads a client’s freelancers', async () => {
    const people = usePeopleStore()
    vi.spyOn(http, 'get').mockResolvedValue({ data: {} })
    expect(await people.fetchFreelancers()).toEqual([])
    expect(people.freelancersLoaded).toBe(true)
  })

  it('invites a freelancer, listing the client’s invitations and revoking one', async () => {
    const people = usePeopleStore()
    vi.spyOn(http, 'get').mockResolvedValue({ data: { invitations: [invitation({ id: 'old' })] } })
    await people.fetchFreelancerInvitations()
    const post = vi.spyOn(http, 'post').mockResolvedValue({ data: { invitation: invitation({ id: 'fresh' }) } })
    await people.inviteFreelancer({ email: 'new@example.test', name: 'Fay' })
    expect(post).toHaveBeenLastCalledWith('/freelancer-invitations', { email: 'new@example.test', name: 'Fay' })
    expect(people.freelancerInvitations.map((i) => i.id)).toEqual(['fresh'])

    const del = vi.spyOn(http, 'delete').mockResolvedValue({ data: {} })
    await people.revokeFreelancerInvitation('fresh')
    expect(del).toHaveBeenLastCalledWith('/freelancer-invitations/fresh')
    expect(people.freelancerInvitations).toEqual([])
  })

  it('looks up and accepts a client’s invitation by its token', async () => {
    const people = usePeopleStore()
    const post = vi.spyOn(http, 'post').mockResolvedValueOnce({ data: { invitation: { email: 'dev@example.test' } } })
    expect(await people.lookupFreelancerInvitation('tok')).toEqual({ email: 'dev@example.test' })
    expect(post).toHaveBeenLastCalledWith('/freelancer-invites/lookup', { token: 'tok' })

    post.mockResolvedValueOnce({ data: { user: makeUser() } })
    const user = await people.acceptFreelancerInvitation('tok', { password: 'p' })
    expect(post).toHaveBeenLastCalledWith('/freelancer-invites/accept', { token: 'tok', password: 'p' })
    expect(user.role).toBe('freelancer')
  })

  it('looks up and accepts an invitation by its token', async () => {
    const people = usePeopleStore()
    const post = vi.spyOn(http, 'post').mockResolvedValueOnce({ data: { invitation: { email: 'new@example.test' } } })
    expect(await people.lookupInvitation('tok')).toEqual({ email: 'new@example.test' })
    expect(post).toHaveBeenLastCalledWith('/invites/lookup', { token: 'tok' })

    post.mockResolvedValueOnce({ data: { user: makeUser({ role: 'client' }) } })
    const user = await people.acceptInvitation('tok', { name: 'A' } as never)
    expect(post).toHaveBeenLastCalledWith('/invites/accept', { token: 'tok', name: 'A' })
    expect(user.role).toBe('client')
  })
})
