import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useAdminStore } from '@/admin/store'
import { adminRoutes } from '@/admin/routes'
import type { Role } from '@/types/auth'

declare module 'vue-router' {
  interface RouteMeta {
    requiresAuth?: boolean
    guestOnly?: boolean
    /** Only users with this role may open the page. */
    role?: Role
    /** Not for members of a client's company: the reports are the owner's. */
    ownerOnly?: boolean
    /** The admin panel: only for the backend's ADMIN_EMAILS. */
    admin?: boolean
  }
}

const HOME = '/dashboard'

const routes: RouteRecordRaw[] = [
  { path: '/', redirect: HOME },
  {
    path: '/login',
    name: 'login',
    component: () => import('@/views/LoginView.vue'),
    meta: { guestOnly: true },
  },
  {
    path: '/register',
    name: 'register',
    component: () => import('@/views/RegisterView.vue'),
    meta: { guestOnly: true },
  },
  {
    // Open to everyone: the link is the proof, and it signs the browser in.
    path: '/confirm-signup/:token?',
    name: 'confirm-signup',
    component: () => import('@/views/ConfirmSignupView.vue'),
  },
  {
    path: '/forgot-password',
    name: 'forgot-password',
    component: () => import('@/views/ForgotPasswordView.vue'),
    meta: { guestOnly: true },
  },
  {
    // Open to everyone: the link is the proof, whoever is signed in here.
    path: '/reset-password/:token?',
    name: 'reset-password',
    component: () => import('@/views/ResetPasswordView.vue'),
  },
  {
    // Open to everyone: the new email may be opened on another device.
    path: '/confirm-email/:token?',
    name: 'confirm-email',
    component: () => import('@/views/ConfirmEmailView.vue'),
  },
  {
    // Open to everyone: a signed-in user may accept for another account.
    path: '/invite/:token?',
    name: 'invite',
    component: () => import('@/views/InviteView.vue'),
  },
  {
    path: '/dashboard',
    name: 'dashboard',
    component: () => import('@/views/DashboardView.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/tasks',
    name: 'tasks',
    component: () => import('@/views/TasksView.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/tasks/:id',
    name: 'task-detail',
    component: () => import('@/views/TaskDetailView.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/projects',
    name: 'projects',
    component: () => import('@/views/ProjectsView.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/projects/:id/settings',
    name: 'project-settings',
    component: () => import('@/views/ProjectSettingsView.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/projects/:id',
    name: 'project-detail',
    component: () => import('@/views/ProjectDetailView.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/archive',
    name: 'archive',
    component: () => import('@/views/ArchiveView.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/reports',
    name: 'reports',
    component: () => import('@/views/ReportsView.vue'),
    meta: { requiresAuth: true, ownerOnly: true },
  },
  {
    path: '/reports/:id',
    name: 'report-detail',
    component: () => import('@/views/ReportView.vue'),
    meta: { requiresAuth: true, ownerOnly: true },
  },
  {
    path: '/clients',
    name: 'clients',
    component: () => import('@/views/ClientsView.vue'),
    meta: { requiresAuth: true, role: 'freelancer' },
  },
  {
    path: '/freelancers',
    name: 'freelancers',
    component: () => import('@/views/FreelancersView.vue'),
    meta: { requiresAuth: true, role: 'client' },
  },
  {
    path: '/team',
    name: 'team',
    component: () => import('@/views/TeamView.vue'),
    meta: { requiresAuth: true, role: 'client' },
  },
  {
    // Open to everyone: joining makes a new account and signs it in.
    path: '/join/:token?',
    name: 'join-team',
    component: () => import('@/views/JoinTeamView.vue'),
  },
  {
    path: '/settings',
    name: 'settings',
    component: () => import('@/views/SettingsView.vue'),
    meta: { requiresAuth: true },
  },
  ...adminRoutes,
  { path: '/:pathMatch(.*)*', redirect: HOME },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

/**
 * Global guard. Auth is initialized (a single GET /api/me) BEFORE any routing
 * decision is made, so a reload never flashes /login before landing on a
 * protected page.
 */
router.beforeEach(async (to) => {
  const auth = useAuthStore()

  if (!auth.isInitialized) {
    await auth.initialize()
  }

  if (to.meta.requiresAuth && !auth.isAuthenticated) {
    return { name: 'login', query: to.fullPath !== HOME ? { redirect: to.fullPath } : {} }
  }

  if (to.meta.guestOnly && auth.isAuthenticated) {
    return HOME
  }

  if (to.meta.role && auth.user?.role !== to.meta.role) {
    return HOME
  }

  if (to.meta.ownerOnly && auth.isTeamMember) {
    return HOME
  }

  if (to.meta.admin) {
    const admin = useAdminStore()
    await admin.load()
    if (!admin.isAdmin) return HOME
  }

  return true
})

export default router
