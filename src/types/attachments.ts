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
  /**
   * The check for malware: "pending" doesn't download yet, "infected" never
   * does (threat names what was found); "clean" and "unscanned" (stored
   * before a scanner was set up) download.
   */
  scan: 'pending' | 'clean' | 'infected' | 'unscanned'
  threat?: string
  /** Shared by every version of the file (the first one's id); versions count from 1. */
  series_id: string
  version: number
  /** No newer version replaced it: the one shown. */
  latest: boolean
  /** What the client's side thinks of this version; null until they say. */
  review: FileReview | null
  reviewed_by: { id: string; name: string; email: string } | null
  reviewed_at: string | null
  /** The task's client side, on the latest version. */
  can_review: boolean
}

export type FileReview = 'approved' | 'changes_requested'
