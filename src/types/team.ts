/**
 * What someone on a client's team is: a member sees all the company's work, a
 * contractor only the tasks they set or were added to.
 */
export type TeamRole = 'member' | 'contractor'

export const TEAM_ROLES: TeamRole[] = ['member', 'contractor']

export interface TeamPerson {
  id: string
  name: string
  email: string
}

export interface TeamMember extends TeamPerson {
  role: TeamRole
  joined_at: string
}

/** A pending invitation to the company; the token builds the join link. */
export interface TeamInvite {
  id: string
  email: string
  name: string
  role: TeamRole
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
  /** The viewer's. */
  role: 'owner' | TeamRole
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
  /** What they join as. */
  role: TeamRole
  owner: TeamPerson
  expires_at: string
}
