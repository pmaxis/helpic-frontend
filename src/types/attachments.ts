/** A file on a task: a mockup, a spec, a result. */
export interface Attachment {
  id: string
  task_id: string
  file_name: string
  /** Read from the file's bytes by the server. */
  content_type: string
  size_bytes: number
  /** A picture the browser may preview. */
  is_image: boolean
  uploaded_by: { id: string; name: string; email: string }
  /** Only the uploader deletes a file. */
  can_delete: boolean
  created_at: string
}
