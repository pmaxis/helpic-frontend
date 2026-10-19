import { http } from '@/services/api'
import type { ProjectPerson } from '@/types/projects'

export interface ProjectPeople {
  participants: ProjectPerson[]
  candidates: ProjectPerson[]
}

/** Who is on the project, and who its author can still invite. */
export async function fetchProjectPeople(projectId: string): Promise<ProjectPeople> {
  const { data } = await http.get<ProjectPeople>(`/projects/${projectId}/people`)
  return { participants: data.participants ?? [], candidates: data.candidates ?? [] }
}

export async function inviteToProject(projectId: string, userIds: string[]): Promise<ProjectPeople> {
  const { data } = await http.post<ProjectPeople>(`/projects/${projectId}/participants`, { user_ids: userIds })
  return { participants: data.participants ?? [], candidates: data.candidates ?? [] }
}

export async function removeProjectParticipant(projectId: string, userId: string): Promise<ProjectPeople> {
  const { data } = await http.delete<ProjectPeople>(`/projects/${projectId}/participants/${userId}`)
  return { participants: data.participants ?? [], candidates: data.candidates ?? [] }
}
