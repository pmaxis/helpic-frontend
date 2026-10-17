export type TaskEventKind =
  | 'created'
  | 'title'
  | 'description'
  | 'due_on'
  | 'project'
  | 'status'
  | 'price'
  | 'priority'
  | 'labels'
  | 'attachment_added'
  | 'attachment_removed'

/** One change in a task's history. */
export interface TaskEvent {
  id: string
  actor: { id: string; name: string; email: string }
  kind: TaskEventKind
  /**
   * The change: `from`/`to` where a value changed (names, YYYY-MM-DD dates,
   * cents; null = none), `currency` for a price, `name` for a file.
   */
  data: {
    from?: string | number | null
    to?: string | number | null
    currency?: string
    name?: string
    category?: string
    /** Label names, on a "labels" event. */
    added?: string[]
    removed?: string[]
  }
  created_at: string
}
