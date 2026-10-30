import { http } from '@/services/api'
import type { Comment, CommentPerson } from '@/types/comments'

/** A task's comments, oldest first. */
export async function listComments(taskId: string): Promise<Comment[]> {
  const { data } = await http.get<{ comments: Comment[] }>('/comments', { params: { task: taskId } })
  return data.comments ?? []
}

/** Who a comment on the task can mention: everyone who sees it. */
export async function listCommentPeople(taskId: string): Promise<CommentPerson[]> {
  const { data } = await http.get<{ people: CommentPerson[] }>('/comments/people', { params: { task: taskId } })
  return data.people ?? []
}

/** A comment on the task, or on a spot of one of its images with a pin. */
export async function createComment(taskId: string, body: string, pin?: { attachment_id: string; x: number; y: number }): Promise<Comment> {
  const { data } = await http.post<{ comment: Comment }>('/comments', pin ? { body, pin } : { body }, { params: { task: taskId } })
  return data.comment
}

export async function updateComment(id: string, body: string): Promise<Comment> {
  const { data } = await http.put<{ comment: Comment }>(`/comments/${id}`, { body })
  return data.comment
}

export async function deleteComment(id: string): Promise<void> {
  await http.delete(`/comments/${id}`)
}
