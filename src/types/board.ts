import type { Task, TaskStatus } from './tasks'

/**
 * A workflow status — one column of the board a freelancer shares with a
 * client (or of a freelancer's personal board). Its category decides what the
 * status means for the rules: new, in progress, done or cancelled.
 */
export interface BoardColumn {
  id: string
  name: string
  category: TaskStatus
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
  category: TaskStatus
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
  /** The freelancer manages the columns; the client only moves cards. */
  can_manage: boolean
  columns: BoardColumn[]
  /** The all board: its columns are lanes merging the boards' columns of one name. */
  merged?: boolean
}
