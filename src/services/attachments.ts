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

/** The file's bytes; inline asks for an image preview. */
export async function attachmentBlob(id: string, inline = false): Promise<Blob> {
  const { data } = await http.get<Blob>(`/attachments/${id}`, { params: inline ? { inline: 1 } : undefined, responseType: 'blob', timeout: 0 })
  return data
}

/** The file's bytes as an object URL (revoke it when done); inline asks for an image preview. */
export async function attachmentURL(id: string, inline = false): Promise<string> {
  return URL.createObjectURL(await attachmentBlob(id, inline))
}

/** How the viewer shows a file in place. */
export type PreviewKind = 'image' | 'pdf' | 'video' | 'audio' | 'text'

/**
 * How a file previews, by the type the server read from its bytes; null for
 * one only downloaded. Anything shown runs through an element that can't run
 * it as a page: an image, the PDF viewer, a player, or text.
 */
export function previewKind(a: Pick<Attachment, 'content_type' | 'is_image'>): PreviewKind | null {
  const type = a.content_type
  if (a.is_image) return 'image'
  if (type === 'application/pdf') return 'pdf'
  if (type === 'video/mp4' || type === 'video/webm') return 'video'
  if (type === 'audio/mpeg' || type === 'audio/wave') return 'audio'
  if (type.startsWith('text/')) return 'text'
  return null
}

/** "PDF", "DOCX" — shown where a file has no picture. */
export function fileExtension(name: string): string {
  const i = name.lastIndexOf('.')
  return i > 0 && name.length - i <= 6 ? name.slice(i + 1).toUpperCase() : 'FILE'
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

/** "840 B", "12 KB", "3.4 MB", "1.2 GB". */
export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`
}
