import type { NotificationKind } from '@/types/notifications'

export interface NotificationKindInfo {
  kind: NotificationKind
  label: string
  /** Who gets it: the freelancer, or the client company's owner; everyone when unset. */
  for?: 'freelancer' | 'owner'
}

/** The kinds of notification, grouped as the settings list them. */
export const NOTIFICATION_GROUPS: { label: string; kinds: NotificationKindInfo[] }[] = [
  {
    label: 'Tasks',
    kinds: [
      { kind: 'task_created', label: 'A task is added' },
      { kind: 'task_status', label: 'A task moves to another status' },
      { kind: 'task_updated', label: 'A task is edited' },
      { kind: 'task_deleted', label: 'A task is deleted' },
    ],
  },
  {
    label: 'Deadlines',
    kinds: [
      { kind: 'task_due_soon', label: 'A task is due tomorrow', for: 'freelancer' },
      { kind: 'task_overdue', label: 'A task is overdue' },
    ],
  },
  {
    label: 'Discussion',
    kinds: [
      { kind: 'comment_added', label: 'Someone comments' },
      { kind: 'attachment_added', label: 'A file is attached' },
    ],
  },
  {
    label: 'Projects & reports',
    kinds: [
      { kind: 'project_created', label: 'A project is started' },
      { kind: 'report_sent', label: 'A report is sent to you', for: 'owner' },
      { kind: 'report_paid', label: 'A report is marked paid', for: 'freelancer' },
    ],
  },
  {
    label: 'People',
    kinds: [
      { kind: 'client_joined', label: 'A client accepts your invitation', for: 'freelancer' },
      { kind: 'member_joined', label: 'Someone joins your team', for: 'owner' },
    ],
  },
]
