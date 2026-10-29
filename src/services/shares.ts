import { http } from '@/services/api'
import type { SharedFile, SharedTask, TaskShare } from '@/types/shares'

/** The task's public link; null when it has none. */
export async function getTaskShare(taskId: string): Promise<TaskShare | null> {
  const { data } = await http.get<{ share: TaskShare | null }>(`/tasks/${taskId}/share`)
  return data.share
}

/** Turns the task's link on; a task that has one keeps it. */
export async function shareTask(taskId: string): Promise<TaskShare> {
  const { data } = await http.post<{ share: TaskShare }>(`/tasks/${taskId}/share`)
  return data.share
}

/** Turns the task's link off: it opens nothing any more. */
export async function unshareTask(taskId: string): Promise<void> {
  await http.delete(`/tasks/${taskId}/share`)
}

/** What a link shows, for anyone holding it. */
export async function fetchSharedTask(token: string): Promise<SharedTask> {
  const { data } = await http.get<{ task: SharedTask }>(`/shared/${encodeURIComponent(token)}`)
  return data.task
}

/** A shared file's bytes; inline asks for an image preview. */
export async function sharedFileBlob(token: string, file: Pick<SharedFile, 'id'>, inline = false): Promise<Blob> {
  const { data } = await http.get<Blob>(`/shared/${encodeURIComponent(token)}/files/${file.id}`, {
    params: inline ? { inline: 1 } : undefined,
    responseType: 'blob',
    timeout: 0,
  })
  return data
}

/** A shared file's bytes as an object URL (revoke it when done); inline asks for an image preview. */
export async function sharedFileURL(token: string, file: Pick<SharedFile, 'id'>, inline = false): Promise<string> {
  return URL.createObjectURL(await sharedFileBlob(token, file, inline))
}

/** Saves a shared file under its name. */
export async function downloadSharedFile(token: string, file: Pick<SharedFile, 'id' | 'file_name'>): Promise<void> {
  const href = await sharedFileURL(token, file)
  const link = document.createElement('a')
  link.href = href
  link.download = file.file_name
  document.body.appendChild(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(href), 1000)
}
