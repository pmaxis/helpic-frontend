import { http } from '@/services/api'
import type { Team, TeamInvite, TeamInviteLookup, TeamRole } from '@/types/team'
import type { User, UserResponse } from '@/types/auth'

export async function fetchTeam(): Promise<Team> {
  const { data } = await http.get<{ team: Team }>('/team')
  return data.team
}

export async function renameTeam(name: string): Promise<Team> {
  const { data } = await http.put<{ team: Team }>('/team', { name })
  return data.team
}

export async function inviteToTeam(email: string, name: string, role: TeamRole): Promise<TeamInvite> {
  const { data } = await http.post<{ invite: TeamInvite }>('/team/invites', { email, name, role })
  return data.invite
}

export async function setTeamMemberRole(id: string, role: TeamRole): Promise<Team> {
  const { data } = await http.put<{ team: Team }>(`/team/members/${id}`, { role })
  return data.team
}

export async function revokeTeamInvite(id: string): Promise<void> {
  await http.delete(`/team/invites/${id}`)
}

export async function removeTeamMember(id: string): Promise<void> {
  await http.delete(`/team/members/${id}`)
}

export async function lookupTeamInvite(token: string): Promise<TeamInviteLookup> {
  const { data } = await http.post<{ invite: TeamInviteLookup }>('/team-invites/lookup', { token })
  return data.invite
}

/** Creates the member's account and signs it in. */
export async function joinTeam(
  token: string,
  input: { name: string; password: string; password_confirmation: string },
): Promise<User> {
  const { data } = await http.post<UserResponse>('/team-invites/accept', { token, ...input })
  return data.user
}
