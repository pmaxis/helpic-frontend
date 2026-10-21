import { http } from '@/services/api'
import type { Task } from '@/types/tasks'

export interface ArchivePage {
  tasks: Task[]
  /** The cursor of the next page; absent on the last one. */
  next?: string
}

/** A page of the archive, the most recently archived first. */
export async function fetchArchive(params: { with?: string; project?: string; before?: string } = {}): Promise<ArchivePage> {
  const { data } = await http.get<ArchivePage>('/archive', {
    params: {
      with: params.with || undefined,
      project: params.project || undefined,
      before: params.before || undefined,
    },
  })
  return { tasks: data.tasks ?? [], next: data.next }
}
