import { http } from '@/services/api'
import type {
  AdminAccountDetail,
  AdminAccountsPage,
  AdminAccountsQuery,
  AdminActionPath,
  AdminActionsPage,
  AdminActionsQuery,
  AdminEmail,
  AdminEmailsPage,
  AdminEmailsQuery,
  AdminLimit,
  AdminSession,
  AdminLogsPage,
  AdminLogsQuery,
  AdminSignupsPage,
  AdminSignupsQuery,
  AdminStats,
  AdminSystem,
} from './types'

/** Totals and the last `days` days, today included (7 to 365). */
export async function fetchAdminStats(days: number): Promise<AdminStats> {
  const { data } = await http.get<AdminStats>('/admin/stats', { params: { days } })
  return data
}

/** A page of accounts, the newest first. */
export async function fetchAdminAccounts(query: AdminAccountsQuery): Promise<AdminAccountsPage> {
  const params = Object.fromEntries(Object.entries(query).filter(([, v]) => v !== '' && v !== undefined))
  const { data } = await http.get<AdminAccountsPage>('/admin/users', { params })
  return data
}

/** One account in full. */
export async function fetchAdminAccount(id: string): Promise<AdminAccountDetail> {
  const { data } = await http.get<{ user: AdminAccountDetail }>(`/admin/users/${id}`)
  return data.user
}

/** A page of the server's warnings and errors, the newest first. */
export async function fetchAdminLogs(query: AdminLogsQuery): Promise<AdminLogsPage> {
  const params = Object.fromEntries(Object.entries(query).filter(([, v]) => v !== '' && v !== undefined))
  const { data } = await http.get<AdminLogsPage>('/admin/logs', { params })
  return data
}

/** Does an action to an account, recorded with the reason; returns the account as it is now. */
export async function actOnAccount(id: string, action: AdminActionPath, reason: string): Promise<AdminAccountDetail> {
  const { data } = await http.post<{ user: AdminAccountDetail }>(`/admin/users/${id}/${action}`, { reason })
  return data.user
}

/** A page of what admins did, the newest first. */
export async function fetchAdminActions(query: AdminActionsQuery): Promise<AdminActionsPage> {
  const params = Object.fromEntries(Object.entries(query).filter(([, v]) => v !== '' && v !== undefined))
  const { data } = await http.get<AdminActionsPage>('/admin/actions', { params })
  return data
}

/** A page of outgoing email, the newest first, with the counts. */
export async function fetchAdminEmails(query: AdminEmailsQuery): Promise<AdminEmailsPage> {
  const params = Object.fromEntries(Object.entries(query).filter(([, v]) => v !== '' && v !== undefined))
  const { data } = await http.get<AdminEmailsPage>('/admin/emails', { params })
  return data
}

/** Sends an email that wasn't sent again, with a fresh set of tries. */
export async function retryEmail(id: string): Promise<AdminEmail> {
  const { data } = await http.post<{ email: AdminEmail }>(`/admin/emails/${id}/retry`)
  return data.email
}

/** A page of the sign-ups still waiting for their link, the newest first. */
export async function fetchAdminSignups(query: AdminSignupsQuery): Promise<AdminSignupsPage> {
  const params = Object.fromEntries(Object.entries(query).filter(([, v]) => v !== '' && v !== undefined))
  const { data } = await http.get<AdminSignupsPage>('/admin/signups', { params })
  return data
}

/** Emails the sign-up a new confirmation link; the old one stops working. */
export async function resendSignup(email: string): Promise<void> {
  await http.post(`/admin/signups/${encodeURIComponent(email)}/resend`)
}

/** Removes a sign-up nobody confirmed. */
export async function deleteSignup(email: string): Promise<void> {
  await http.delete(`/admin/signups/${encodeURIComponent(email)}`)
}

/** The services Helpic depends on, checked now, and the background jobs. */
export async function fetchAdminSystem(): Promise<AdminSystem> {
  const { data } = await http.get<AdminSystem>('/admin/system')
  return data
}

/** Posts a test message to the admins' alert chat. */
export async function sendTestAlert(): Promise<void> {
  await http.post('/admin/system/test-alert')
}

/** The devices an account is signed in on, the most recently used first. */
export async function fetchAccountSessions(id: string): Promise<AdminSession[]> {
  const { data } = await http.get<{ sessions: AdminSession[] }>(`/admin/users/${id}/sessions`)
  return data.sessions
}

/** Signs an account out of one device, recorded with the reason; returns the account as it is now. */
export async function endAccountSession(id: string, session: string, reason: string): Promise<AdminAccountDetail> {
  const { data } = await http.post<{ user: AdminAccountDetail }>(`/admin/users/${id}/sessions/${session}/end`, { reason })
  return data.user
}

/** The rate limits refusing attempts now, the longest first. */
export async function fetchAdminLimits(query: { q?: string; account?: string }): Promise<AdminLimit[]> {
  const params = Object.fromEntries(Object.entries(query).filter(([, v]) => v !== '' && v !== undefined))
  const { data } = await http.get<{ limits: AdminLimit[] }>('/admin/limits', { params })
  return data.limits
}

/** Lifts a rate limit at once. */
export async function clearAdminLimit(limit: Pick<AdminLimit, 'scope' | 'key'>): Promise<void> {
  await http.post('/admin/limits/clear', { scope: limit.scope, key: limit.key })
}
