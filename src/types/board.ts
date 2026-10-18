import type { Task, TaskStatus } from './tasks'

/** To do, in progress, or done. Chosen when the status is created. */
export type StatusCategory = 'todo' | 'in_progress' | 'done'

/**
 * A workflow status — one column of the board a freelancer shares with a
 * client (or of a freelancer's personal board). `category` is the bucket the
 * rest of the product uses: the colour, the open filter, and who may move a
 * card here. `status_category` is the fixed category behind that bucket.
 */
export interface BoardColumn {
  id: string
  name: string
  category: TaskStatus
  status_category: StatusCategory
  participants_can_move: boolean
  /** Present on GET /board, absent on GET /board/columns. */
  tasks?: Task[]
}

/** A label of a board, with how many of its tasks carry it. */
export interface BoardLabel {
  id: string
  name: string
  color: string
  task_count: number
}

export interface ColumnInput {
  name: string
  /** Empty on rename leaves the category as it is. */
  status_category?: StatusCategory
}

/**
 * Which board: a project's, or the one with a counterpart — a client's ID or
 * "personal" for a freelancer, a freelancer's ID for a client.
 */
export interface BoardScope {
  /** "all" is a freelancer's every task on one board, its columns merged by name. */
  with?: string
  project?: string
  /** Keep only these projects' tasks; "none" keeps the tasks outside any project. */
  projects?: string[]
}

export interface BoardResponse {
  /** The freelancer manages the columns, and so does the project's author. */
  can_manage: boolean
  columns: BoardColumn[]
  /** The all board: its columns are lanes merging the boards' columns of one name. */
  merged?: boolean
}
