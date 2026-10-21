import { http } from '@/services/api'
import type { Task } from '@/types/tasks'

export interface ArchivePage {
  tasks: Task[]
  /** Which page this is, from 1. */
  page: number
  /** How many tasks a page holds. */
  limit: number
  /** How many there are in all. */
  total: number
}

/** A numbered page of the archive, the most recently archived first. */
export async function fetchArchive(params: { with?: string; project?: string; page?: number } = {}): Promise<ArchivePage> {
  const { data } = await http.get<ArchivePage>('/archive', {
    params: {
      with: params.with || undefined,
      project: params.project || undefined,
      page: params.page && params.page > 1 ? params.page : undefined,
    },
  })
  return { tasks: data.tasks ?? [], page: data.page, limit: data.limit, total: data.total }
}
