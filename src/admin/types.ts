import type { Role } from '@/types/auth'

/** The app as it stands. */
export interface AdminTotals {
  users: number
  freelancers: number
  clients: number
  /** Sign-ups that haven't opened their confirmation link yet. */
  pending_signups: number
  two_factor: number
  /** Active users today, over the last 7 days and over 30, today included. */
  active_day: number
  active_week: number
  active_month: number
  tasks: number
  projects: number
}

/** What happened over a stretch of days. */
export interface AdminPeriod {
  /** People who used Helpic on any of the days. */
  active: number
  new_users: number
  tasks_created: number
  tasks_completed: number
}

/** One day, in the backend's time zone. */
export interface AdminDay {
  /** YYYY-MM-DD */
  day: string
  signups: number
  active: number
  tasks_created: number
  tasks_completed: number
}

export type AdminSeries = Exclude<keyof AdminDay, 'day'>

export interface AdminStats {
  from: string
  to: string
  totals: AdminTotals
  period: AdminPeriod
  /** The period before, as long. */
  previous: AdminPeriod
  days: AdminDay[]
  previous_days: AdminDay[]
}

/** An account as the panel lists it: who, and how much they use Helpic. */
export interface AdminAccount {
  id: string
  email: string
  name: string
  role: Exclude<Role, 'admin'>
  two_factor: boolean
  /** When an admin blocked them; null when they aren't. */
  blocked_at: string | null
  tasks: number
  projects: number
  /** On how many of the last 30 days they used Helpic. */
  active_days: number
  /** The last day they used Helpic, YYYY-MM-DD; null if never. */
  last_active: string | null
  created_at: string
}

/** One account in full: still counts and metadata, never their work. */
export interface AdminAccountDetail extends AdminAccount {
  locale: 'en' | 'uk'
  currency: string
  team: { name: string; role: 'owner' | 'member' | 'contractor'; members: number } | null
  /** A freelancer's clients, or a client's freelancers. */
  partners: number
  reports_sent: number
  reports_paid: number
  seconds_logged: number
  comments: number
  /** What they uploaded to tasks, and how much; quota_bytes is how much they may, 0 for no limit. */
  files: number
  files_bytes: number
  quota_bytes: number
  telegram: boolean
  /** Signed-in devices now. */
  sessions: number
  last_sign_in: string | null
  /** The Monday 26 weeks back; active_on are the days since then they used Helpic. */
  active_since: string
  active_on: string[]
}

export interface AdminAccountsPage {
  users: AdminAccount[]
  page: number
  limit: number
  total: number
}

/** One of the server's warnings or errors. */
export interface AdminLog {
  id: number
  at: string
  level: 'WARN' | 'ERROR'
  message: string
  /** What was logged with it: for a request its method, route, status, IP and who made it; for a failure the error. */
  attrs: Record<string, unknown>
}

export type AdminLogLevel = '' | 'warn' | 'error'

export interface AdminLogsQuery {
  level?: AdminLogLevel
  q?: string
  page?: number
  limit?: number
}

export interface AdminLogsPage {
  logs: AdminLog[]
  page: number
  limit: number
  /** How many match the filters in all. */
  total: number
  /** Over the last 24 hours, whatever the filter. */
  warnings: number
  errors: number
}

export type AdminActivity = '' | 'active' | 'idle' | 'never' | 'blocked'
export type AdminSort = 'created' | 'last_active' | 'tasks'

export interface AdminAccountsQuery {
  q?: string
  role?: Exclude<Role, 'admin'> | ''
  activity?: AdminActivity
  sort?: AdminSort
  page?: number
  limit?: number
}

/** What an admin can do to an account, as the API's path names it. */
export type AdminActionPath = 'block' | 'unblock' | 'end-sessions' | 'reset-two-factor'

/** One thing an admin did to an account. */
export interface AdminAction {
  id: number
  at: string
  /** Null once the account is gone; the email stays. */
  admin_id: string | null
  admin_email: string
  action: 'block' | 'unblock' | 'end_sessions' | 'reset_two_factor' | 'retry_email' | 'resend_signup' | 'delete_signup' | 'end_session' | 'clear_limit' | 'lock_admin' | 'unlock_admin' | 'reset_admin'
  target_id: string | null
  target_email: string
  reason: string
}

export interface AdminActionsQuery {
  /** Only the actions on this account. */
  target?: string
  page?: number
  limit?: number
}

export interface AdminActionsPage {
  actions: AdminAction[]
  page: number
  limit: number
  total: number
}

export type AdminEmailStatus = 'queued' | 'failed' | 'sent'

/** An outgoing email: whom to, about what and how sending it went. Never the body. */
export interface AdminEmail {
  id: string
  to: string
  subject: string
  status: AdminEmailStatus
  attempts: number
  last_error: string
  /** When a queued email is tried next. */
  next_attempt_at: string
  sent_at: string | null
  created_at: string
}

/** How many emails stand where, over the week the outbox keeps them. */
export interface AdminEmailCounts {
  queued: number
  failed: number
  sent: number
  last_sent: string | null
}

export interface AdminEmailsQuery {
  status?: AdminEmailStatus | ''
  q?: string
  page?: number
  limit?: number
}

export interface AdminEmailsPage {
  emails: AdminEmail[]
  page: number
  limit: number
  total: number
  counts: AdminEmailCounts
}

/** A public sign-up that hasn't opened its confirmation link. */
export interface AdminSignup {
  email: string
  name: string
  locale: string
  created_at: string
  expires_at: string
  /** How the newest email to the address went; empty once it is no longer kept. */
  email_status: AdminEmailStatus | ''
  email_error: string
}

export interface AdminSignupsQuery {
  q?: string
  page?: number
  limit?: number
}

export interface AdminSignupsPage {
  signups: AdminSignup[]
  page: number
  limit: number
  total: number
}

/** A service Helpic depends on, checked on the spot; "off" is left out of the config. */
export interface AdminCheck {
  name: 'database' | 'mail' | 'telegram' | 'alerts'
  state: 'ok' | 'failing' | 'off'
  latency_ms: number
  error: string
}

/** How a background job ran on this server since it started. */
export interface AdminJob {
  name: string
  interval_seconds: number
  last_run: string | null
  last_success: string | null
  last_error: string
  running: boolean
  runs: number
  failures: number
  state: 'ok' | 'failing' | 'late' | 'waiting'
}

export interface AdminSystem {
  version: string
  go_version: string
  started_at: string
  checks: AdminCheck[]
  jobs: AdminJob[]
  /** The files uploaded to tasks: how many, and how much they take. */
  files: { count: number; bytes: number }
  /** The disk keeping the files on tasks; null when the server can't read it. */
  disk: { total_bytes: number; free_bytes: number } | null
}

/** A device an account is signed in on. */
export interface AdminSession {
  id: string
  user_agent: string
  ip: string
  created_at: string
  last_used_at: string
}

export type AdminLimitScope =
  | 'sign-in'
  | 'sign-up'
  | 'refresh'
  | 'login-failures'
  | 'login-failures-email'
  | 'password-checks'
  | 'two-factor-codes'
  | 'reset'
  | 'reset-email'
  | 'invites'

/** A rate limit refusing someone right now. */
export interface AdminLimit {
  scope: AdminLimitScope
  key: string
  /** What the key is: an address, an email, both, or a user's ID. */
  kind: 'ip' | 'email' | 'email_ip' | 'user'
  email: string
  ip: string
  /** The account it holds back; null when there is none. */
  account_id: string | null
  account_email: string
  burst: number
  every_seconds: number
  /** When the next attempt is let through. */
  opens_at: string
}

/** An admin account and the devices it is signed in on. */
export interface AdminAccountAdmin {
  id: string
  email: string
  name: string
  two_factor: boolean
  created_at: string
  last_sign_in: string | null
  sessions: AdminSession[]
}

export type AdminSignInOutcome = 'ok' | 'wrong_password' | 'wrong_code' | 'limited'

/** One sign-in to an admin account, or an attempt that got the password or the code wrong. */
export interface AdminSignIn {
  id: number
  at: string
  /** Null once the account is gone; the email stays. */
  admin_id: string | null
  admin_email: string
  outcome: AdminSignInOutcome
  ip: string
  user_agent: string
}

export interface AdminSignInsPage {
  sign_ins: AdminSignIn[]
  page: number
  limit: number
  total: number
}
