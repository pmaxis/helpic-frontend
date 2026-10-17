import type { Role } from '@/types/auth'

/** Sidebar words: keys under "nav" in the messages. */
export type NavKey = 'dashboard' | 'work' | 'people' | 'projects' | 'tasks' | 'reports' | 'clients' | 'freelancers' | 'team'

export interface NavItem {
  label: NavKey
  icon: string
  to: string
}

export interface NavSection {
  /** Empty for the top section, which needs no heading. */
  label: NavKey | ''
  items: NavItem[]
}

/** The sidebar per role: the overview, the work, then who it's with. Labels are message keys. */
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
  ],
}

/** Pages a member of a client's company doesn't see: the reports are the owner's. */
export const OWNER_ONLY_PATHS = ['/reports']
