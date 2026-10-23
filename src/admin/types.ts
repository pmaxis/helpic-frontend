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

export type AdminActivity = '' | 'active' | 'idle' | 'never'
export type AdminSort = 'created' | 'last_active' | 'tasks'

export interface AdminAccountsQuery {
  q?: string
  role?: Exclude<Role, 'admin'> | ''
  activity?: AdminActivity
  sort?: AdminSort
  page?: number
  limit?: number
}
