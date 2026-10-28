import { defineStore } from 'pinia'
import { http } from '@/services/api'
import type { User, UserResponse } from '@/types/auth'
import type {
  AcceptInvitationPayload,
  FreelancerInvitationLookup,
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
  /** The client's pending invitations for freelancers; a company's owner's alone. */
  freelancerInvitations: Invitation[]
}

/** Who works with whom: a freelancer's clients, a client's freelancers, and the invitations each sends. */
export const usePeopleStore = defineStore('people', {
  state: (): PeopleState => ({ clients: [], invitations: [], freelancers: [], freelancersLoaded: false, freelancerInvitations: [] }),

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

    async fetchFreelancerInvitations(): Promise<void> {
      const { data } = await http.get<{ invitations: Invitation[] }>('/freelancer-invitations')
      this.freelancerInvitations = data.invitations ?? []
    },

    async inviteFreelancer(input: InvitationInput): Promise<Invitation> {
      const { data } = await http.post<{ invitation: Invitation }>('/freelancer-invitations', input)
      this.freelancerInvitations = [data.invitation, ...this.freelancerInvitations.filter((i) => i.email !== data.invitation.email)]
      return data.invitation
    },

    async revokeFreelancerInvitation(id: string): Promise<void> {
      await http.delete(`/freelancer-invitations/${id}`)
      this.freelancerInvitations = this.freelancerInvitations.filter((i) => i.id !== id)
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

    async lookupFreelancerInvitation(token: string): Promise<FreelancerInvitationLookup> {
      const { data } = await http.post<{ invitation: FreelancerInvitationLookup }>('/freelancer-invites/lookup', { token })
      return data.invitation
    },

    /** Accepts a client's invitation; the backend signs the freelancer in and returns them. */
    async acceptFreelancerInvitation(token: string, payload: AcceptInvitationPayload): Promise<User> {
      const { data } = await http.post<UserResponse>('/freelancer-invites/accept', { token, ...payload })
      return data.user
    },
  },
})
