import type { Party } from './people'

export type TaskStatus = 'new' | 'in_progress' | 'done' | 'cancelled'

/** How urgent a task is; either side sets it. */
export type TaskPriority = 'none' | 'low' | 'medium' | 'high' | 'urgent'

/** A tag from the task's board, shared by its freelancer and client. */
export interface TaskLabel {
  id: string
  name: string
  /** A name from the palette, e.g. "violet" (see LABEL_COLORS). */
  color: string
}

export interface Task {
  id: string
  freelancer: Party
  /** Null for a freelancer's personal task. */
  client: Party | null
  /** Null for a task outside any project. */
  project: { id: string; name: string } | null
  /** The exact workflow status (board column); `status` is its category. */
  status_id: string
  status_name: string
  /** The card's place in its column; null until someone orders it. */
  position: number | null
  /** ID of the user who created the task. */
  created_by: string
  /** Who set the task: either side, or a member of the client's company. */
  creator: Party
  /** Who took part: the freelancer first, then everyone who set, commented on, attached to or changed it. */
  participants: Party[]
  title: string
  description: string
  status: TaskStatus
  /** YYYY-MM-DD */
  due_on: string | null
  /** Null while the task has no price. */
  price_cents: number | null
  /** The freelancer's currency. */
  currency: string
  priority: TaskPriority
  /** Sorted by name. */
  labels: TaskLabel[]
  /** Statuses the current user may move the task to. */
  next_statuses: TaskStatus[]
  can_edit: boolean
  can_delete: boolean
  /** Only the task's freelancer sets its price, in any status. */
  can_set_price: boolean
  /** False for a member of the client's team: the price is left out for them. */
  can_see_price: boolean
  created_at: string
  updated_at: string
}

export interface TaskInput {
  /** Set by a client creating a task. */
  freelancer_id?: string
  /** Set by a freelancer creating a task for a client; omitted for a personal task. */
  client_id?: string
  /** On edit, "" takes the task out of its project. */
  project_id?: string
  /** Create the task straight in this board column. */
  status_id?: string
  title: string
  description: string
  due_on: string | null
  /** An amount like "1200.50", set by a freelancer on create; later through setPrice. */
  price?: string
  /** Set on create; later through setPriority. */
  priority?: TaskPriority
}
