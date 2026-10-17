import { http } from '@/services/api'
import type { NotificationKind } from '@/types/notifications'
import type { TelegramLink, TelegramStatus } from '@/types/telegram'

export async function fetchTelegram(): Promise<TelegramStatus> {
  const { data } = await http.get<{ telegram: TelegramStatus }>('/me/telegram')
  return data.telegram
}

/** A one-time t.me link, good for 15 minutes. */
export async function createTelegramLink(): Promise<TelegramLink> {
  const { data } = await http.post<{ link: TelegramLink }>('/me/telegram/link')
  return data.link
}

export async function setTelegramKinds(kinds: NotificationKind[]): Promise<TelegramStatus> {
  const { data } = await http.put<{ telegram: TelegramStatus }>('/me/telegram/kinds', { kinds })
  return data.telegram
}

export async function disconnectTelegram(): Promise<void> {
  await http.delete('/me/telegram')
}
