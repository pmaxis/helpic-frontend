import type { Task, TaskStatus } from './tasks'

/**
 * A status group on a board. The owner names it and decides whether its tasks
 * count as open or finished, and who may move a task into it.
 */
export interface BoardCategory {
  id: string
  name: string
  effect: 'open' | 'done' | 'closed'
  participants_can_move: boolean
  allows_delete: boolean
}

/**
 * A workflow status — one column of the board a freelancer shares with a
 * client (or of a freelancer's personal board). `category` is the bucket the
 * rest of the product uses (the colour, the open filter). `category_name` is
 * the group the owner configured.
 */
export interface BoardColumn {
  id: string
  name: string
  category: TaskStatus
  category_id: string
  category_name: string
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
  category_id?: string
  /** Older boards: the bucket, which selects the seeded category of that name. */
  category?: TaskStatus
}

export interface CategoryInput {
  name: string
  effect: BoardCategory['effect']
  participants_can_move: boolean
  allows_delete: boolean
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
  /** The freelancer manages the columns and categories, and so does the project's author. */
  can_manage: boolean
  columns: BoardColumn[]
  categories?: BoardCategory[]
  /** The all board: its columns are lanes merging the boards' columns of one name. */
  merged?: boolean
}
