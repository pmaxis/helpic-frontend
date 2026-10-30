export type NotificationKind =
  | 'task_created'
  | 'task_status'
  | 'task_updated'
  | 'task_deleted'
  | 'participant_added'
  | 'project_created'
  | 'project_invited'
  | 'client_joined'
  | 'freelancer_joined'
  | 'member_joined'
  | 'report_sent'
  | 'report_paid'
  | 'report_comment'
  | 'report_recalled'
  | 'attachment_added'
  | 'comment_added'
  | 'comment_mention'
  | 'task_due_soon'
  | 'task_overdue'

/** Something the other side of shared work did. */
export interface AppNotification {
  id: string
  kind: NotificationKind
  /** Who did it; null for a reminder, which nobody did. */
  actor: { id: string; name: string; email: string } | null
  task_id: string | null
  project_id: string | null
  report_id: string | null
  /** The task's or project's title at the time. */
  subject: string
  /** Extra context, e.g. the new status, or a reminder's due date (YYYY-MM-DD). */
  detail: string
  read: boolean
  created_at: string
}
