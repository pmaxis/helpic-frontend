import { http } from '@/services/api'
import type { Locale } from '@/i18n'
import type { AdminPolicy, PolicyKind } from '@/types/policies'
import type {
  AdminAccountAdmin,
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
  AdminSignInsPage,
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

/** Does an action to an account, confirmed with the admin's two-factor code and recorded with the reason; returns the account as it is now. */
export async function actOnAccount(id: string, action: AdminActionPath, reason: string, code: string): Promise<AdminAccountDetail> {
  const { data } = await http.post<{ user: AdminAccountDetail }>(`/admin/users/${id}/${action}`, { reason, code })
  return data.user
}

/** Deletes the account for its owner; recorded with the reason. */
export async function deleteAdminAccount(id: string, reason: string, code: string): Promise<void> {
  await http.delete(`/admin/users/${id}`, { data: { reason, code } })
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

/** Signs an account out of one device, confirmed with the admin's two-factor code and recorded with the reason; returns the account as it is now. */
export async function endAccountSession(id: string, session: string, reason: string, code: string): Promise<AdminAccountDetail> {
  const { data } = await http.post<{ user: AdminAccountDetail }>(`/admin/users/${id}/sessions/${session}/end`, { reason, code })
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

/** Every admin, the oldest first, with their devices. */
export async function fetchAdmins(): Promise<AdminAccountAdmin[]> {
  const { data } = await http.get<{ admins: AdminAccountAdmin[] }>('/admin/admins')
  return data.admins
}

/** A page of sign-ins to admin accounts, the newest first; `failed` keeps only the ones that didn't go through, `admin` one admin's. */
export async function fetchAdminSignIns(query: { failed?: boolean; admin?: string; page?: number; limit?: number }): Promise<AdminSignInsPage> {
  const params = Object.fromEntries(Object.entries(query).filter(([, v]) => v !== false && v !== '' && v !== undefined))
  const { data } = await http.get<AdminSignInsPage>('/admin/sign-ins', { params })
  return data
}

/** Signs an admin out of one device, confirmed with your own two-factor code; they get an email and the alert chat hears of it. */
export async function endAdminSession(id: string, session: string, reason: string, code: string): Promise<void> {
  await http.post(`/admin/admins/${id}/sessions/${session}/end`, { reason, code })
}

/** Every policy in every language, with who wrote it last. */
export async function fetchAdminPolicies(): Promise<AdminPolicy[]> {
  const { data } = await http.get<{ policies: AdminPolicy[] }>('/admin/policies')
  return data.policies
}

/** Makes `body` the policy in `locale`; readers see it at once. */
export async function saveAdminPolicy(kind: PolicyKind, locale: Locale, body: string): Promise<AdminPolicy> {
  const { data } = await http.put<{ policy: AdminPolicy }>(`/admin/policies/${kind}/${locale}`, { body })
  return data.policy
}

/** Puts Helpic's own text back for the policy in `locale`. */
export async function resetAdminPolicy(kind: PolicyKind, locale: Locale): Promise<AdminPolicy> {
  const { data } = await http.delete<{ policy: AdminPolicy }>(`/admin/policies/${kind}/${locale}`)
  return data.policy
}
