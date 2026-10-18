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

/** A freelancer's pending invitation. The link goes only to the invited address. */
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

/** What the public invitation page shows. */
export interface InvitationLookup {
  email: string
  name: string
  freelancer: Party
  account_exists: boolean
  expires_at: string
}

export interface AcceptInvitationPayload {
  name?: string
  password: string
  password_confirmation?: string
}
