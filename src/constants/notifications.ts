import type { NotificationKind } from '@/types/notifications'

export interface NotificationKindInfo {
  kind: NotificationKind
  /** Who gets it: the freelancer, the client company's owner, anyone on the client's side; everyone when unset. */
  for?: 'freelancer' | 'owner' | 'client'
}

/** Groups of kinds: keys under "notificationKinds.groups" in the messages. */
export type NotificationGroupKey = 'tasks' | 'deadlines' | 'discussion' | 'projectsReports' | 'people'

/** The kinds of notification, grouped as the settings list them; each kind's words are under "notificationKinds". */
export const NOTIFICATION_GROUPS: { group: NotificationGroupKey; kinds: NotificationKindInfo[] }[] = [
  {
    group: 'tasks',
    kinds: [
      { kind: 'task_created' },
      { kind: 'task_status' },
      { kind: 'task_updated' },
      { kind: 'task_deleted' },
      { kind: 'participant_added', for: 'client' },
    ],
  },
  {
    group: 'deadlines',
    kinds: [
      { kind: 'task_due_soon', for: 'freelancer' },
      { kind: 'task_overdue' },
    ],
  },
  {
    group: 'discussion',
    kinds: [
      { kind: 'comment_added' },
      { kind: 'attachment_added' },
    ],
  },
  {
    group: 'projectsReports',
    kinds: [
      { kind: 'project_created' },
      { kind: 'project_invited' },
      { kind: 'report_sent', for: 'owner' },
      { kind: 'report_paid', for: 'freelancer' },
    ],
  },
  {
    group: 'people',
    kinds: [
      { kind: 'client_joined', for: 'freelancer' },
      { kind: 'member_joined', for: 'owner' },
    ],
  },
]
