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
  /** Only the creator edits and deletes a project. */
  can_edit: boolean
  created_at: string
  updated_at: string
}

export interface ProjectInput {
  /** Set by a client creating a project. */
  freelancer_id?: string
  /** Set by a freelancer creating a project for a client; omitted for a personal one. */
  client_id?: string
  name: string
  description: string
}
