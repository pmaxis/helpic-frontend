export type NotificationKind =
  | 'task_created'
  | 'task_status'
  | 'task_updated'
  | 'task_deleted'
  | 'project_created'
  | 'client_joined'
  | 'member_joined'
  | 'report_sent'
  | 'report_paid'
  | 'attachment_added'
  | 'comment_added'

/** Something the other side of shared work did. */
export interface AppNotification {
  id: string
  kind: NotificationKind
  actor: { id: string; name: string; email: string }
  task_id: string | null
  project_id: string | null
  report_id: string | null
  /** The task's or project's title at the time. */
  subject: string
  /** Extra context, e.g. the new status. */
  detail: string
  read: boolean
  created_at: string
}
