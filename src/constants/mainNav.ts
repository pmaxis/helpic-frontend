import type { Role } from '@/types/auth'

export interface NavItem {
  label: string
  icon: string
  to: string
}

export interface NavSection {
  /** Empty for the top section, which needs no heading. */
  label: string
  items: NavItem[]
}

/** The sidebar per role: the overview, the work, then who it's with. */
export const NAV_SECTIONS: Record<Role, NavSection[]> = {
  freelancer: [
    { label: '', items: [{ label: 'Dashboard', icon: 'dashboard', to: '/dashboard' }] },
    {
      label: 'Work',
      items: [
        { label: 'Projects', icon: 'projects', to: '/projects' },
        { label: 'Tasks', icon: 'tasks', to: '/tasks' },
        { label: 'Reports', icon: 'reports', to: '/reports' },
      ],
    },
    { label: 'People', items: [{ label: 'Clients', icon: 'clients', to: '/clients' }] },
  ],
  client: [
    { label: '', items: [{ label: 'Dashboard', icon: 'dashboard', to: '/dashboard' }] },
    {
      label: 'Work',
      items: [
        { label: 'Projects', icon: 'projects', to: '/projects' },
        { label: 'Tasks', icon: 'tasks', to: '/tasks' },
        { label: 'Reports', icon: 'reports', to: '/reports' },
      ],
    },
    {
      label: 'People',
      items: [
        { label: 'Freelancers', icon: 'freelancers', to: '/freelancers' },
        { label: 'Team', icon: 'clients', to: '/team' },
      ],
    },
  ],
}

/** Pages a member of a client's company doesn't see: the reports are the owner's. */
export const OWNER_ONLY_PATHS = ['/reports']
