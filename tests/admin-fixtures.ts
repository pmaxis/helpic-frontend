/** Made-up admin records: valid by default, with only what a test cares about overridden. */
import type {
  AdminAccount,
  AdminAccountAdmin,
  AdminAccountDetail,
  AdminAction,
  AdminDay,
  AdminEmail,
  AdminLimit,
  AdminLog,
  AdminSession,
  AdminSignIn,
  AdminSignup,
  AdminStats,
  AdminSystem,
} from '@/admin/types'
import { makeUser } from './fixtures'

const MAC = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Chrome/130.0 Safari/537.36'

/** An admin who may open the panel: two-factor is on. */
export const admin = () => makeUser({ id: 'adm', role: 'admin', email: 'root@helpic.test', name: 'Root', two_factor: true })

export function makeAccount(over: Partial<AdminAccount> = {}): AdminAccount {
  return { id: 'u1', email: 'olena@example.test', name: 'Olena', role: 'freelancer', two_factor: false, blocked_at: null, tasks: 4, projects: 1, active_days: 3, last_active: '2030-03-14', created_at: '2030-01-01T00:00:00Z', ...over }
}

export function makeAccountDetail(over: Partial<AdminAccountDetail> = {}): AdminAccountDetail {
  return {
    ...makeAccount(),
    locale: 'en',
    currency: 'USD',
    team: null,
    partners: 2,
    reports_sent: 1,
    reports_paid: 1,
    seconds_logged: 5400,
    comments: 7,
    files: 4,
    files_bytes: 3 * 1024 * 1024,
    quota_bytes: 1024 * 1024 * 1024,
    telegram: false,
    sessions: 1,
    last_sign_in: '2030-03-14T09:00:00Z',
    active_since: '2029-09-16',
    active_on: ['2030-03-14'],
    ...over,
  }
}

export function makeSession(over: Partial<AdminSession> = {}): AdminSession {
  return { id: 's1', user_agent: MAC, ip: '10.0.0.1', created_at: '2030-03-01T00:00:00Z', last_used_at: '2030-03-14T09:00:00Z', ...over }
}

export function makeLimit(over: Partial<AdminLimit> = {}): AdminLimit {
  return { scope: 'sign-in', key: 'k1', kind: 'ip', email: '', ip: '10.0.0.9', account_id: 'u1', account_email: 'olena@example.test', burst: 5, every_seconds: 60, opens_at: new Date(Date.now() + 10 * 60_000).toISOString(), ...over }
}

export function makeAction(over: Partial<AdminAction> = {}): AdminAction {
  return { id: 1, at: '2030-03-14T09:00:00Z', admin_id: 'adm', admin_email: 'root@helpic.test', action: 'block', target_id: 'u1', target_email: 'olena@example.test', reason: 'Spam', ...over }
}

export function makeEmail(over: Partial<AdminEmail> = {}): AdminEmail {
  return { id: 'e1', to: 'olena@example.test', subject: 'Confirm your email', status: 'sent', attempts: 1, last_error: '', next_attempt_at: '2030-03-14T09:00:00Z', sent_at: '2030-03-14T09:00:00Z', created_at: '2030-03-14T08:59:00Z', ...over }
}

export function makeSignup(over: Partial<AdminSignup> = {}): AdminSignup {
  return { email: 'new@example.test', name: 'New', locale: 'en', created_at: '2030-03-14T08:00:00Z', expires_at: '2030-03-15T08:00:00Z', email_status: 'sent', email_error: '', ...over }
}

export function makeLog(over: Partial<AdminLog> = {}): AdminLog {
  return { id: 1, at: '2030-03-14T09:00:00Z', level: 'ERROR', message: 'request failed', attrs: { method: 'POST', route: '/api/v1/tasks', status: 500, error: 'db down' }, ...over }
}

export function makeAdmin(over: Partial<AdminAccountAdmin> = {}): AdminAccountAdmin {
  return { id: 'adm', email: 'root@helpic.test', name: 'Root', two_factor: true, created_at: '2030-01-01T00:00:00Z', last_sign_in: '2030-03-14T09:00:00Z', sessions: [makeSession()], ...over }
}

export function makeSignIn(over: Partial<AdminSignIn> = {}): AdminSignIn {
  return { id: 1, at: '2030-03-14T09:00:00Z', admin_id: 'adm', admin_email: 'root@helpic.test', outcome: 'ok', ip: '10.0.0.1', user_agent: MAC, ...over }
}

function days(n: number, from = new Date(2030, 2, 15)): AdminDay[] {
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(from.getTime() - (n - 1 - i) * 86_400_000)
    const day = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    return { day, signups: i % 3, active: 5 + (i % 4), tasks_created: i % 5, tasks_completed: i % 2 }
  })
}

export function makeStats(length = 30): AdminStats {
  const list = days(length)
  return {
    from: list[0].day,
    to: list[list.length - 1].day,
    totals: { users: 15, freelancers: 7, clients: 8, pending_signups: 2, two_factor: 3, active_day: 1, active_week: 15, active_month: 15, tasks: 72, projects: 8 },
    period: { active: 15, new_users: 6, tasks_created: 32, tasks_completed: 22 },
    previous: { active: 0, new_users: 3, tasks_created: 8, tasks_completed: 8 },
    days: list,
    previous_days: days(length, new Date(2030, 2, 15 - length)),
  }
}

export function makeSystem(over: Partial<AdminSystem> = {}): AdminSystem {
  return {
    version: '1.4.0',
    go_version: 'go1.26',
    started_at: new Date(Date.now() - 2 * 3600_000).toISOString(),
    checks: [
      { name: 'database', state: 'ok', latency_ms: 3, error: '' },
      { name: 'mail', state: 'failing', latency_ms: 120, error: 'connection refused' },
      { name: 'telegram', state: 'off', latency_ms: 0, error: '' },
      { name: 'alerts', state: 'ok', latency_ms: 40, error: '' },
    ],
    jobs: [
      { name: 'reminders', interval_seconds: 3600, last_run: new Date().toISOString(), last_success: new Date().toISOString(), last_error: '', running: false, runs: 3, failures: 0, state: 'ok' },
      { name: 'mail', interval_seconds: 30, last_run: null, last_success: null, last_error: 'smtp', running: true, runs: 0, failures: 2, state: 'failing' },
    ],
    emails: { queued: 1, failed: 2, sent: 30, last_sent: new Date().toISOString() },
    storage: {
      files: 12,
      bytes: 1.5 * 1024 * 1024 * 1024,
      accounts: 3,
      near_quota: 1,
      quota_bytes: 1024 * 1024 * 1024,
      max_file_bytes: 25 * 1024 * 1024,
      top: [
        { id: 'u-big', email: 'big@example.test', name: 'Big Uploader', files: 9, bytes: 0.95 * 1024 * 1024 * 1024 },
        { id: 'u-small', email: 'small@example.test', name: '', files: 3, bytes: 20 * 1024 * 1024 },
      ],
      disk: { total_bytes: 100 * 1024 ** 3, free_bytes: 40 * 1024 ** 3 },
    },
    ...over,
  }
}
