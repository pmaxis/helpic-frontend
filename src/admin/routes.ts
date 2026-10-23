import type { RouteRecordRaw } from 'vue-router'

/** The admin panel; its pages load only when an admin opens them. */
export const adminRoutes: RouteRecordRaw[] = [
  {
    path: '/admin',
    name: 'admin',
    component: () => import('./views/AdminStatsView.vue'),
    meta: { requiresAuth: true, admin: true },
  },
  {
    path: '/admin/users',
    name: 'admin-users',
    component: () => import('./views/AdminUsersView.vue'),
    meta: { requiresAuth: true, admin: true },
  },
]
