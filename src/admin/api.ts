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
