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
]
