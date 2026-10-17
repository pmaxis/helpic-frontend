<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { usePeopleStore } from '@/stores/people'
import { useTasksStore } from '@/stores/tasks'
import { useProjectsStore } from '@/stores/projects'
import { useBoardStore } from '@/stores/board'
import { useReportsStore } from '@/stores/reports'
import { useNotificationsStore } from '@/stores/notifications'
import AppLogo from '@/components/ui/AppLogo.vue'
import SidebarSection from '@/components/navigation/SidebarSection.vue'
import SidebarItem from '@/components/navigation/SidebarItem.vue'
import NotificationBell from '@/components/navigation/NotificationBell.vue'
import { NAV_SECTIONS, OWNER_ONLY_PATHS } from '@/constants/mainNav'

withDefaults(
  defineProps<{
    /** Let the page fill the content area's height (e.g. a board), instead of growing with its content. */
    fill?: boolean
    /** Leave out the white card around the page, for pages made of several cards. */
    bare?: boolean
  }>(),
  { fill: false, bare: false },
)

const auth = useAuthStore()
const notifications = useNotificationsStore()
onMounted(() => notifications.startPolling())
const router = useRouter()
const loggingOut = ref(false)
const mobileOpen = ref(false)

const COLLAPSE_KEY = 'helpic:sidebar-collapsed'

function readCollapsed(): boolean {
  try {
    return localStorage.getItem(COLLAPSE_KEY) === '1'
  } catch {
    return false
  }
}

const collapsed = ref(readCollapsed())

function toggleCollapsed() {
  collapsed.value = !collapsed.value
  try {
    localStorage.setItem(COLLAPSE_KEY, collapsed.value ? '1' : '0')
  } catch {
    // ignore storage failures (private browsing, disabled storage, etc.)
  }
}

const navSections = computed(() => {
  if (!auth.user) return []
  const sections = NAV_SECTIONS[auth.user.role]
  if (!auth.isTeamMember) return sections
  return sections.map((s) => ({ ...s, items: s.items.filter((i) => !OWNER_ONLY_PATHS.includes(i.to)) }))
})
const displayName = computed(() => auth.user?.name || auth.user?.email || '')
const initials = computed(() => {
  const words = (auth.user?.name ?? '').split(/\s+/).filter(Boolean)
  if (words.length) return words.slice(0, 2).map((w) => w[0]).join('').toUpperCase()
  return (auth.user?.email ?? '').slice(0, 2).toUpperCase() || '·'
})

async function handleLogout() {
  loggingOut.value = true
  try {
    await auth.logout()
    // Drop the previous account's data before someone else signs in.
    usePeopleStore().$reset()
    useTasksStore().$reset()
    useProjectsStore().$reset()
    useBoardStore().$reset()
    useReportsStore().$reset()
    notifications.stopPolling()
    notifications.$reset()
    await router.replace({ name: 'login' })
  } finally {
    loggingOut.value = false
  }
}
</script>

<template>
  <div class="flex h-full overflow-hidden bg-white">
    <div
      v-if="mobileOpen"
      class="fixed inset-0 z-40 bg-neutral-900/20 md:hidden"
      @click="mobileOpen = false"
    />

    <aside
      :class="[
        'fixed inset-y-0 left-0 z-50 flex shrink-0 flex-col border-r border-neutral-200 bg-white transition-all duration-200 ease-in-out md:static',
        mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0',
        collapsed ? 'w-64 md:w-16' : 'w-64',
      ]"
    >
      <button
        type="button"
        title="Toggle sidebar"
        aria-label="Toggle sidebar"
        class="absolute top-8 -right-3 z-10 hidden h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full border border-neutral-200 bg-white text-neutral-500 shadow-sm transition-colors hover:bg-neutral-100 hover:text-neutral-900 md:flex"
        @click="toggleCollapsed"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          class="h-3.5 w-3.5 transition-transform"
          :class="collapsed ? 'rotate-180' : ''"
        >
          <polyline points="15 18 9 12 15 6" />
        </svg>
      </button>

      <div :class="['flex items-center border-b border-neutral-200 py-4', collapsed ? 'justify-center px-2' : 'px-4']">
        <!-- the mark alone while the sidebar is folded -->
        <AppLogo :mark-only="collapsed" />
      </div>

      <nav class="flex flex-1 flex-col gap-6 overflow-y-auto overflow-x-hidden px-3 py-4">
        <SidebarSection v-for="section in navSections" :key="section.label || 'top'" :label="section.label" :collapsed="collapsed">
          <SidebarItem
            v-for="item in section.items"
            :key="item.to"
            :icon="item.icon"
            :label="item.label"
            :to="item.to"
            :collapsed="collapsed"
            @click="mobileOpen = false"
          />
        </SidebarSection>
      </nav>

      <div :class="['border-t border-neutral-200', collapsed ? 'p-2' : 'p-3']">
        <div :class="['flex items-center gap-1 rounded-md', collapsed ? 'flex-col gap-2' : '']">
          <RouterLink
            to="/settings"
            :title="collapsed ? 'Settings' : undefined"
            :class="[
              'flex min-w-0 items-center rounded-md text-neutral-600 transition-colors hover:bg-neutral-100 hover:text-neutral-900',
              collapsed ? 'justify-center p-2' : 'flex-1 gap-3 px-2 py-2',
            ]"
            active-class="bg-neutral-100"
            @click="mobileOpen = false"
          >
            <span class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-neutral-200 text-xs font-semibold text-neutral-700">
              {{ initials }}
            </span>
            <span v-show="!collapsed" class="min-w-0 flex-1">
              <span class="block truncate text-sm font-medium text-neutral-900">{{ displayName }}</span>
              <span class="block truncate text-xs text-neutral-400">{{ auth.user?.name ? auth.user.email : 'Settings' }}</span>
            </span>
          </RouterLink>
          <NotificationBell />
          <button
            type="button"
            title="Log out"
            :disabled="loggingOut"
            class="shrink-0 rounded-md p-1.5 text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-900 focus:outline-none disabled:cursor-not-allowed disabled:text-neutral-300"
            @click="handleLogout"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-4 w-4">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
          </button>
        </div>
      </div>
    </aside>

    <div class="flex h-full min-h-0 min-w-0 flex-1 flex-col bg-neutral-50">
      <header class="flex shrink-0 items-center gap-3 border-b border-neutral-200 bg-white/90 px-4 py-3 backdrop-blur md:hidden">
        <button
          type="button"
          class="rounded-md p-1.5 text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-900 focus:outline-none"
          @click="mobileOpen = true"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-5 w-5">
            <path d="M4 12h16M4 6h16M4 18h16" />
          </svg>
        </button>
        <AppLogo :size="28" />
      </header>

      <main class="flex w-full min-h-0 flex-1 flex-col px-4 py-4">
        <!-- a bare page lays out its own cards -->
        <div v-if="bare" class="flex min-h-0 flex-1 flex-col">
          <slot />
        </div>
        <div v-else class="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-xs">
          <div class="min-h-0 flex-1 overflow-y-auto p-5 sm:p-8" :class="fill ? 'flex flex-col' : ''">
            <slot />
          </div>
        </div>
      </main>
    </div>
  </div>
</template>
