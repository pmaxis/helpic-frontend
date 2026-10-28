/** The other side of a freelancer–client pair. */
export interface Party {
  id: string
  name: string
  email: string
}

/** A client (as the freelancer sees it) or a freelancer (as the client sees it). */
export interface Link extends Party {
  linked_at: string
  open_tasks: number
}

/** A pending invitation, a freelancer's for a client or a client's for a freelancer. The link goes only to the invited address. */
export interface Invitation {
  id: string
  email: string
  name: string
  expired: boolean
  expires_at: string
  created_at: string
}

export interface InvitationInput {
  email: string
  name: string
}

/** What the public invitation page shows for a freelancer's invitation. */
export interface InvitationLookup {
  email: string
  name: string
  freelancer: Party
  account_exists: boolean
  expires_at: string
}

/** What the public invitation page shows for a client's invitation; company is "" without one. */
export interface FreelancerInvitationLookup {
  email: string
  name: string
  client: Party
  company: string
  account_exists: boolean
  expires_at: string
}

export interface AcceptInvitationPayload {
  name?: string
  password: string
  password_confirmation?: string
  /** For an existing account with two-factor on. */
  code?: string
}
