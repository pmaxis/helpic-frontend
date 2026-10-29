import type { TaskStatus } from '@/types/tasks'

/** A task's public link, as its creator or its freelancer sees it. */
export interface TaskShare {
  /** The page the link opens, to copy and send. */
  url: string
  created_at: string
}

/** A file on a shared task; who uploaded it isn't said. */
export interface SharedFile {
  id: string
  file_name: string
  content_type: string
  size_bytes: number
  is_image: boolean
  scan: 'pending' | 'clean' | 'infected' | 'unscanned'
}

/** A task as its link shows it: no people, price, time or comments. */
export interface SharedTask {
  title: string
  description: string
  status: TaskStatus
  status_name: string
  /** YYYY-MM-DD, or null. */
  due_on: string | null
  /** Closed: paid, or put away. */
  archived: boolean
  subtasks: { title: string; status: TaskStatus; status_name: string }[]
  files: SharedFile[]
}
