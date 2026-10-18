import { defineStore } from 'pinia'
import { http } from '@/services/api'
import type { User, UserResponse } from '@/types/auth'
import type {
  AcceptInvitationPayload,
  Invitation,
  InvitationInput,
  InvitationLookup,
  Link,
} from '@/types/people'

interface PeopleState {
  /** The freelancer's clients. */
  clients: Link[]
  /** The freelancer's pending invitations. */
  invitations: Invitation[]
  /** The client's freelancers. */
  freelancers: Link[]
  freelancersLoaded: boolean
}

/** Who works with whom: a freelancer's clients and invitations, a client's freelancers. */
export const usePeopleStore = defineStore('people', {
  state: (): PeopleState => ({ clients: [], invitations: [], freelancers: [], freelancersLoaded: false }),

  actions: {
    async fetchClients(): Promise<void> {
      const [clients, invitations] = await Promise.all([
        http.get<{ clients: Link[] }>('/clients'),
        http.get<{ invitations: Invitation[] }>('/invitations'),
      ])
      this.clients = clients.data.clients ?? []
      this.invitations = invitations.data.invitations ?? []
    },

    async invite(input: InvitationInput): Promise<Invitation> {
      const { data } = await http.post<{ invitation: Invitation }>('/invitations', input)
      this.invitations = [data.invitation, ...this.invitations.filter((i) => i.email !== data.invitation.email)]
      return data.invitation
    },

    async revokeInvitation(id: string): Promise<void> {
      await http.delete(`/invitations/${id}`)
      this.invitations = this.invitations.filter((i) => i.id !== id)
    },

    async fetchFreelancers(): Promise<Link[]> {
      const { data } = await http.get<{ freelancers: Link[] }>('/freelancers')
      this.freelancers = data.freelancers ?? []
      this.freelancersLoaded = true
      return this.freelancers
    },

    async lookupInvitation(token: string): Promise<InvitationLookup> {
      const { data } = await http.post<{ invitation: InvitationLookup }>('/invites/lookup', { token })
      return data.invitation
    },

    /** Accepts an invitation; the backend signs the client in and returns them. */
    async acceptInvitation(token: string, payload: AcceptInvitationPayload): Promise<User> {
      const { data } = await http.post<UserResponse>('/invites/accept', { token, ...payload })
      return data.user
    },
  },
})
