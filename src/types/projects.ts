import type { Party } from './people'

export interface Project {
  id: string
  freelancer: Party
  /** Null for a freelancer's personal project. */
  client: Party | null
  created_by: string
  name: string
  description: string
  open_tasks: number
  total_tasks: number
  /** People on the project, the author first. Role says which side they are. */
  participants: Array<Party & { role?: ProjectPerson['role'] }>
  /** Only the creator edits and deletes a project, and invites its participants. */
  can_edit: boolean
  /** A freelancer on the project sets their own hourly rate for it. */
  can_set_rate: boolean
  /** The rate the viewer set on this project; null: their own rate applies. */
  my_hourly_rate_cents: number | null
  created_at: string
  updated_at: string
}

/** Someone on a project, or someone its author can invite. */
export interface ProjectPerson {
  id: string
  name: string
  email: string
  role: 'freelancer' | 'owner' | 'member' | 'contractor'
}

export interface ProjectInput {
  /** One freelancer, kept for callers that name a single one. */
  freelancer_id?: string
  /** The freelancers a client starts the project with. */
  freelancer_ids?: string[]
  /** Set by a freelancer creating a project for a client; omitted for a personal one. */
  client_id?: string
  name: string
  description: string
}
