import { http } from '@/services/api'
import type { Session } from '@/types/auth'

/** The user's signed-in devices, the most recently used first. */
export async function fetchSessions(): Promise<Session[]> {
  const { data } = await http.get<{ sessions: Session[] }>('/me/sessions')
  return data.sessions
}

/** Signs one device out; it stays in for a few minutes at most. */
export async function endSession(id: string): Promise<void> {
  await http.delete(`/me/sessions/${id}`)
}

/** Signs out every device but this one. */
export async function endOtherSessions(): Promise<void> {
  await http.delete('/me/sessions')
}
