/** Someone who sees the task, so a comment on it can mention them. */
export interface CommentPerson {
  id: string
  name: string
  email: string
}

/** A message in a task's discussion: Markdown, mentioning people as @[Name](user ID). */
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
