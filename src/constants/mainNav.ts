import type { Role } from '@/types/auth'

/** Sidebar words: keys under "nav" in the messages. */
export type NavKey = 'dashboard' | 'work' | 'people' | 'projects' | 'tasks' | 'archive' | 'closedTasks' | 'reports' | 'clients' | 'freelancers' | 'team' | 'adminStats' | 'adminAccounts' | 'adminLogs' | 'system'

export interface NavItem {
  label: NavKey
  icon: string
  to: string
  /** Active on its page only: the pages under it are items of their own. */
  exact?: boolean
}

export interface NavSection {
  /** Empty for the top section, which needs no heading. */
  label: NavKey | ''
  items: NavItem[]
}

/**
 * The sidebar per role: the overview, the work, who it's with, then the
 * archive of closed work; an admin's is the admin panel: the statistics, the
 * accounts, then the server. Labels are message keys.
 */
export const NAV_SECTIONS: Record<Role, NavSection[]> = {
  freelancer: [
    { label: '', items: [{ label: 'dashboard', icon: 'dashboard', to: '/dashboard' }] },
    {
      label: 'work',
      items: [
        { label: 'projects', icon: 'projects', to: '/projects' },
        { label: 'tasks', icon: 'tasks', to: '/tasks' },
        { label: 'reports', icon: 'reports', to: '/reports' },
      ],
    },
    { label: 'people', items: [{ label: 'clients', icon: 'clients', to: '/clients' }] },
    { label: 'archive', items: [{ label: 'closedTasks', icon: 'archive', to: '/archive' }] },
  ],
  client: [
    { label: '', items: [{ label: 'dashboard', icon: 'dashboard', to: '/dashboard' }] },
    {
      label: 'work',
      items: [
        { label: 'projects', icon: 'projects', to: '/projects' },
        { label: 'tasks', icon: 'tasks', to: '/tasks' },
        { label: 'reports', icon: 'reports', to: '/reports' },
      ],
    },
    {
      label: 'people',
      items: [
        { label: 'freelancers', icon: 'freelancers', to: '/freelancers' },
        { label: 'team', icon: 'clients', to: '/team' },
      ],
    },
    { label: 'archive', items: [{ label: 'closedTasks', icon: 'archive', to: '/archive' }] },
  ],
  admin: [
    { label: '', items: [{ label: 'adminStats', icon: 'stats', to: '/admin', exact: true }] },
    { label: 'people', items: [{ label: 'adminAccounts', icon: 'clients', to: '/admin/users' }] },
    { label: 'system', items: [{ label: 'adminLogs', icon: 'logs', to: '/admin/logs' }] },
  ],
}

/** Pages a member of a client's company doesn't see: the reports are the owner's. */
export const OWNER_ONLY_PATHS = ['/reports']
