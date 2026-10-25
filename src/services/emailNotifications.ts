import { http } from '@/services/api'
import type { NotificationKind } from '@/types/notifications'

/** What goes to the user by email. */
export interface EmailNotificationPrefs {
  /** Emailed kinds; none means no email. */
  kinds: NotificationKind[]
  available: NotificationKind[]
  default_kinds: NotificationKind[]
}

export async function fetchEmailNotifications(): Promise<EmailNotificationPrefs> {
  const { data } = await http.get<{ email_notifications: EmailNotificationPrefs }>('/me/email-notifications')
  return data.email_notifications
}

export async function setEmailNotificationKinds(kinds: NotificationKind[]): Promise<EmailNotificationPrefs> {
  const { data } = await http.put<{ email_notifications: EmailNotificationPrefs }>('/me/email-notifications', { kinds })
  return data.email_notifications
}

/** What the bell shows: all kinds until the user chooses. */
export interface AppNotificationPrefs {
  kinds: NotificationKind[]
  available: NotificationKind[]
  default_kinds: NotificationKind[]
}

export async function fetchAppNotifications(): Promise<AppNotificationPrefs> {
  const { data } = await http.get<{ app_notifications: AppNotificationPrefs }>('/me/app-notifications')
  return data.app_notifications
}

export async function setAppNotificationKinds(kinds: NotificationKind[]): Promise<AppNotificationPrefs> {
  const { data } = await http.put<{ app_notifications: AppNotificationPrefs }>('/me/app-notifications', { kinds })
  return data.app_notifications
}
