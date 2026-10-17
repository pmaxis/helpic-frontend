export interface TeamPerson {
  id: string
  name: string
  email: string
}

export interface TeamMember extends TeamPerson {
  joined_at: string
}

/** A pending invitation to the company; the token builds the join link. */
export interface TeamInvite {
  id: string
  email: string
  name: string
  token: string
  expired: boolean
  expires_at: string
  created_at: string
}

/**
 * A client's company as the viewer sees it. The owner (the client a
 * freelancer invited) runs it; a member sees its name and owner only.
 */
export interface Team {
  role: 'owner' | 'member'
  name: string
  owner: TeamPerson
  /** The owner's view only. */
  members?: TeamMember[]
  invites?: TeamInvite[]
}

/** What the join page shows before someone joins. */
export interface TeamInviteLookup {
  email: string
  name: string
  company: string
  owner: TeamPerson
  expires_at: string
}
