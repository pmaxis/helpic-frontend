/** Time a freelancer spent on a task on one day: written in by hand, or counted by a timer. */
export interface TimeEntry {
  id: string
  task_id: string
  task_title: string
  user: { id: string; name: string; email: string }
  /** YYYY-MM-DD */
  spent_on: string
  /** The time so far; while running_since is set, the timer adds the time since then. */
  seconds: number
  note: string
  running_since: string | null
  /** The author changes and deletes it. */
  can_edit: boolean
  created_at: string
}

export interface TimeEntryInput {
  /** YYYY-MM-DD */
  spent_on: string
  /** Like "1:30", "1h 30m", "45m" or "1.5" (hours). */
  duration: string
  note: string
}
