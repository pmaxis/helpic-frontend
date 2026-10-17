import { http } from '@/services/api'
import type { Attachment } from '@/types/attachments'

/** A task's files, and the largest file the server takes. */
export async function listAttachments(taskId: string): Promise<{ attachments: Attachment[]; maxSize: number }> {
  const { data } = await http.get<{ attachments: Attachment[]; max_size_bytes: number }>('/attachments', { params: { task: taskId } })
  return { attachments: data.attachments ?? [], maxSize: data.max_size_bytes }
}

/** Uploads one file; onProgress gets 0…1 as it goes. */
export async function uploadAttachment(taskId: string, file: File, onProgress?: (share: number) => void): Promise<Attachment> {
  const form = new FormData()
  form.append('file', file)
  const { data } = await http.post<{ attachment: Attachment }>('/attachments', form, {
    params: { task: taskId },
    // Let the browser set the multipart boundary (the app default is JSON).
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 0,
    onUploadProgress: (e) => onProgress?.(e.total ? e.loaded / e.total : 0),
  })
  return data.attachment
}

export async function deleteAttachment(id: string): Promise<void> {
  await http.delete(`/attachments/${id}`)
}

/** The file's bytes as an object URL (revoke it when done); inline asks for an image preview. */
export async function attachmentURL(id: string, inline = false): Promise<string> {
  const { data } = await http.get<Blob>(`/attachments/${id}`, { params: inline ? { inline: 1 } : undefined, responseType: 'blob', timeout: 0 })
  return URL.createObjectURL(data)
}

/** Saves the file under its name. */
export async function downloadAttachment(a: Attachment): Promise<void> {
  const href = await attachmentURL(a.id)
  const link = document.createElement('a')
  link.href = href
  link.download = a.file_name
  document.body.appendChild(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(href), 1000)
}

/** "840 B", "12 KB", "3.4 MB". */
export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
