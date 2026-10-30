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
  /** The spot on one of the task's images it's about; null for the task as a whole. */
  pin: CommentPin | null
}

/** A spot on an image: x and y are fractions of its width and height from the top left corner. */
export interface CommentPin {
  /** Null once the image was deleted. */
  attachment_id: string | null
  x: number
  y: number
}
