import { http } from '@/services/api'
import type { TaskEvent } from '@/types/history'

/** Who changed what on a task, oldest first. */
export async function fetchHistory(taskId: string): Promise<TaskEvent[]> {
  const { data } = await http.get<{ events: TaskEvent[] }>(`/tasks/${taskId}/history`)
  return data.events ?? []
}
