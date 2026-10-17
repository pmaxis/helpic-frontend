import { http } from '@/services/api'
import type { Comment } from '@/types/comments'

/** A task's comments, oldest first. */
export async function listComments(taskId: string): Promise<Comment[]> {
  const { data } = await http.get<{ comments: Comment[] }>('/comments', { params: { task: taskId } })
  return data.comments ?? []
}

export async function createComment(taskId: string, body: string): Promise<Comment> {
  const { data } = await http.post<{ comment: Comment }>('/comments', { body }, { params: { task: taskId } })
  return data.comment
}

export async function updateComment(id: string, body: string): Promise<Comment> {
  const { data } = await http.put<{ comment: Comment }>(`/comments/${id}`, { body })
  return data.comment
}

export async function deleteComment(id: string): Promise<void> {
  await http.delete(`/comments/${id}`)
}
