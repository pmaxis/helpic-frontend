import type { NotificationKind } from '@/types/notifications'

/** The user's Telegram connection. */
export interface TelegramStatus {
  /** False when the server has no bot. */
  enabled: boolean
  connected: boolean
  /** The connected Telegram account's handle or first name. */
  username: string
  /** The kinds sent to the chat. */
  kinds: NotificationKind[]
  linked_at: string | null
  /** The kinds that can go to Telegram, and those on when a chat is connected. */
  available: NotificationKind[]
  default_kinds: NotificationKind[]
}

/** A one-time link to the bot that connects the chat it is opened in. */
export interface TelegramLink {
  url: string
  expires_at: string
}
