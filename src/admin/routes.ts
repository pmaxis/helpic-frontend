import type { RouteRecordRaw } from 'vue-router'

/** The admin panel, the admin role's pages; they load only when an admin opens them. */
export const adminRoutes: RouteRecordRaw[] = [
  {
    path: '/admin',
    name: 'admin',
    component: () => import('./views/AdminStatsView.vue'),
    meta: { requiresAuth: true, role: 'admin' },
  },
  {
    path: '/admin/users',
    name: 'admin-users',
    component: () => import('./views/AdminUsersView.vue'),
    meta: { requiresAuth: true, role: 'admin' },
  },
  {
    path: '/admin/logs',
    name: 'admin-logs',
    component: () => import('./views/AdminLogsView.vue'),
    meta: { requiresAuth: true, role: 'admin' },
  },
  {
    path: '/admin/actions',
    name: 'admin-actions',
    component: () => import('./views/AdminActionsView.vue'),
    meta: { requiresAuth: true, role: 'admin' },
  },
  {
    path: '/admin/signups',
    name: 'admin-signups',
    component: () => import('./views/AdminSignupsView.vue'),
    meta: { requiresAuth: true, role: 'admin' },
  },
  {
    path: '/admin/emails',
    name: 'admin-emails',
    component: () => import('./views/AdminEmailsView.vue'),
    meta: { requiresAuth: true, role: 'admin' },
  },
  {
    path: '/admin/system',
    name: 'admin-system',
    component: () => import('./views/AdminSystemView.vue'),
    meta: { requiresAuth: true, role: 'admin' },
  },
  {
    path: '/admin/limits',
    name: 'admin-limits',
    component: () => import('./views/AdminLimitsView.vue'),
    meta: { requiresAuth: true, role: 'admin' },
  },
  {
    path: '/admin/admins',
    name: 'admin-admins',
    component: () => import('./views/AdminAdminsView.vue'),
    meta: { requiresAuth: true, role: 'admin' },
  },
]
