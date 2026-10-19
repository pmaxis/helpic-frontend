import { http } from '@/services/api'
import type { Task, TaskPerson } from '@/types/tasks'

/** Who on the task's client side can be on it; empty for a personal task. */
export async function fetchTaskPeople(taskId: string): Promise<TaskPerson[]> {
  const { data } = await http.get<{ people: TaskPerson[] }>(`/tasks/${taskId}/people`)
  return data.people
}

/** Sets the task's freelancer, or clears the assignee when freelancerId is empty. */
export async function assignTaskFreelancer(taskId: string, freelancerId: string): Promise<Task> {
  const { data } = await http.put<{ task: Task }>(`/tasks/${taskId}/freelancer`, { freelancer_id: freelancerId })
  return data.task
}

export async function addTaskParticipant(taskId: string, userId: string): Promise<Task> {
  const { data } = await http.post<{ task: Task }>(`/tasks/${taskId}/participants`, { user_id: userId })
  return data.task
}

export async function removeTaskParticipant(taskId: string, userId: string): Promise<void> {
  await http.delete(`/tasks/${taskId}/participants/${userId}`)
}
