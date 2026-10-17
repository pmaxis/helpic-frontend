/** A message in a task's discussion. */
export interface Comment {
  id: string
  task_id: string
  author: { id: string; name: string; email: string }
  body: string
  /** Changed after it was written. */
  edited: boolean
  /** The author's: they may edit and delete it. */
  can_edit: boolean
  created_at: string
  updated_at: string
}
