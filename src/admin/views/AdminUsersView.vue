<script setup lang="ts">
/**
 * Every account, a page at a time: search by email or name, filter by role
 * and by how active they are, sort by a column. A row opens the account in a
 * card beside the list, which then leaves out the role, activity and join date;
 * the open account is in the address (?account=…), so it can be linked to
 * and survives a reload.
 */
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import BaseInput from '@/components/ui/BaseInput.vue'
import SelectInput from '@/components/ui/SelectInput.vue'
import Pagination from '@/components/ui/Pagination.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import FilterIllustration from '@/components/illustrations/FilterIllustration.vue'
import { toast } from '@/composables/useToasts'
import { formatDate } from '@/utils/format'
import AdminShell from '../components/AdminShell.vue'
import AccountAvatar from '../components/AccountAvatar.vue'
import AccountPanel from '../components/AccountPanel.vue'
import { timeAgoDay } from '../chart'
import { fetchAdminAccounts } from '../api'
import { useAuthStore } from '@/stores/auth'
import type { AdminAccountsPage, AdminActivity, AdminSort } from '../types'
import type { Role } from '@/types/auth'

const { t } = useI18n()
const auth = useAuthStore()
const route = useRoute()
const router = useRouter()

const LIMIT = 10
const query = ref('')
const role = ref<Exclude<Role, 'admin'> | ''>('')
const activity = ref<AdminActivity>('')
const sort = ref<AdminSort>('created')
const page = ref(1)
const result = ref<AdminAccountsPage | null>(null)
const loading = ref(false)

const roleOptions = computed(() => [
  { value: '', label: t('admin.allRoles') },
  { value: 'freelancer', label: t('admin.roles.freelancer') },
  { value: 'client', label: t('admin.roles.client') },
])

const ACTIVITIES: AdminActivity[] = ['', 'active', 'idle', 'never', 'blocked']

/** Answers that come back after a newer request was sent are dropped. */
let latest = 0

async function load() {
  if (!auth.canOpenAdmin) return
  const mine = ++latest
  loading.value = true
  try {
    const data = await fetchAdminAccounts({
      q: query.value.trim(),
      role: role.value,
      activity: activity.value,
      sort: sort.value,
      page: page.value,
      limit: LIMIT,
    })
    if (mine === latest) result.value = data
  } catch {
    if (mine === latest) toast.error(t('admin.loadFailed'))
  } finally {
    if (mine === latest) loading.value = false
  }
}

// Typing waits for a pause; the filters, the order and the page load at once.
let typing: ReturnType<typeof setTimeout> | undefined
watch(query, () => {
  clearTimeout(typing)
  typing = setTimeout(() => {
    page.value = 1
    void load()
  }, 300)
})
watch([role, activity, sort], () => {
  page.value = 1
  void load()
})
watch(page, load)
onBeforeUnmount(() => clearTimeout(typing))
// Two-factor may have been turned on since the access was asked.
void load()

// --- the columns that sort ---------------------------------------------------------

const SORTABLE: { key: AdminSort; label: string; align: 'left' | 'right' }[] = [
  { key: 'tasks', label: 'admin.columns.tasks', align: 'right' },
  { key: 'last_active', label: 'admin.columns.lastActive', align: 'left' },
  { key: 'created', label: 'admin.columns.joined', align: 'left' },
]
const sortable = (key: AdminSort) => SORTABLE.find((s) => s.key === key)!
/** The sorting columns shown: beside an open account, not the join date. */
const columns = computed<AdminSort[]>(() => (openId.value ? ['tasks', 'last_active'] : ['tasks', 'last_active', 'created']))

// --- the open account ----------------------------------------------------------------

const openId = computed(() => (typeof route.query.account === 'string' ? route.query.account : null))

function open(id: string) {
  void router.replace({ query: { ...route.query, account: id } })
}
function close() {
  const { account: _, ...rest } = route.query
  void router.replace({ query: rest })
}

/** A share of the last 30 days, for the little activity meter. */
function activeShare(days: number): number {
  return Math.min(100, Math.round((days / 30) * 100))
}
</script>

<template>
  <AdminShell :title="$t('nav.adminAccounts')" :description="$t('admin.usersDescription')" :fill="!!result && !result.users.length">
    <div class="flex flex-wrap items-end gap-3">
      <BaseInput v-model="query" :label="$t('admin.search')" type="search" class="min-w-56 flex-1" />
      <SelectInput v-model="role" :options="roleOptions" class="w-44" :aria-label="$t('admin.columns.role')" />
    </div>

    <div class="mt-3 inline-flex flex-wrap rounded-lg border border-neutral-200 bg-neutral-100 p-[3px] text-sm" role="group" :aria-label="$t('admin.columns.activity')">
      <button
        v-for="a in ACTIVITIES"
        :key="a || 'all'"
        type="button"
        class="rounded-md px-2.5 py-1 font-medium transition-colors"
        :class="activity === a ? 'bg-white text-neutral-900 shadow-xs' : 'text-neutral-500 hover:text-neutral-900'"
        :aria-pressed="activity === a"
        :title="a ? $t(`admin.activityHint.${a}`) : undefined"
        @click="activity = a"
      >
        {{ $t(`admin.activity.${a || 'all'}`) }}
      </button>
    </div>

    <EmptyState v-if="result && !result.users.length" class="mt-6 flex-1 justify-center" :title="$t('admin.noAccounts')" :description="$t('admin.noAccountsText')">
      <template #illustration>
        <FilterIllustration />
      </template>
    </EmptyState>

    <div v-else class="mt-4 overflow-x-auto rounded-xl border border-neutral-200 transition-opacity" :class="loading && result ? 'opacity-60' : ''">
      <table class="w-full text-left text-sm" :class="openId ? 'min-w-[28rem]' : 'min-w-[52rem]'">
        <thead class="border-b border-neutral-200 bg-neutral-50 text-xs text-neutral-500">
          <tr>
            <th scope="col" class="px-4 py-2.5 font-medium">{{ $t('admin.columns.account') }}</th>
            <template v-if="!openId">
              <th scope="col" class="px-4 py-2.5 font-medium">{{ $t('admin.columns.role') }}</th>
              <th scope="col" class="px-4 py-2.5 font-medium">{{ $t('admin.columns.activity') }}</th>
            </template>
            <th
              v-for="key in columns"
              :key="key"
              scope="col"
              class="px-4 py-2.5 font-medium"
              :class="sortable(key).align === 'right' ? 'text-right' : ''"
              :aria-sort="sort === key ? 'descending' : 'none'"
            >
              <button
                type="button"
                class="inline-flex items-center gap-1 rounded transition-colors hover:text-neutral-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900/20"
                :class="sort === key ? 'text-neutral-900' : ''"
                :aria-label="$t('admin.sortBy', { column: $t(sortable(key).label) })"
                @click="sort = key"
              >
                {{ $t(sortable(key).label) }}
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" class="h-3 w-3" :class="sort === key ? '' : 'opacity-0'" aria-hidden="true">
                  <path d="m6 9 6 6 6-6" />
                </svg>
              </button>
            </th>
          </tr>
        </thead>
        <tbody class="divide-y divide-neutral-100">
          <tr
            v-for="u in result?.users ?? []"
            :key="u.id"
            class="cursor-pointer transition-colors hover:bg-neutral-50"
            :class="openId === u.id ? 'bg-neutral-50' : ''"
            @click="open(u.id)"
          >
            <td class="max-w-80 px-4 py-2.5">
              <!-- the row's click is for the pointer; the name is the keyboard's way in -->
              <button type="button" class="flex w-full min-w-0 items-center gap-3 text-left focus:outline-none focus-visible:underline" @click.stop="open(u.id)">
                <AccountAvatar :name="u.name" :email="u.email" />
                <span class="min-w-0">
                  <span class="flex items-center gap-1.5">
                    <span class="truncate font-medium text-neutral-900">{{ u.name || u.email }}</span>
                    <span v-if="u.two_factor" class="shrink-0 rounded bg-emerald-50 px-1 text-[10px] font-semibold text-emerald-700" :title="$t('admin.twoFactor')">2FA</span>
                    <span v-if="u.blocked_at" class="shrink-0 rounded bg-red-50 px-1 text-[10px] font-semibold text-red-700">{{ $t('admin.manage.blocked') }}</span>
                  </span>
                  <span v-if="u.name" class="block truncate text-xs text-neutral-500">{{ u.email }}</span>
                </span>
              </button>
            </td>
            <td v-if="!openId" class="px-4 py-2.5 text-neutral-600">{{ $t(`admin.roles.${u.role}`) }}</td>
            <td v-if="!openId" class="px-4 py-2.5">
              <div class="flex items-center gap-2">
                <div class="h-1.5 w-16 rounded-full bg-neutral-100" aria-hidden="true">
                  <div class="h-full rounded-full bg-emerald-500" :style="{ width: `${u.active_days ? Math.max(activeShare(u.active_days), 6) : 0}%` }" />
                </div>
                <span class="text-xs text-neutral-600 tabular-nums">{{ u.active_days }}</span>
              </div>
            </td>
            <td class="px-4 py-2.5 text-right text-neutral-600 tabular-nums">{{ u.tasks }}</td>
            <td class="px-4 py-2.5 whitespace-nowrap" :class="u.last_active ? 'text-neutral-600' : 'text-neutral-400'">
              {{ u.last_active ? timeAgoDay(u.last_active) : $t('admin.never') }}
            </td>
            <td v-if="!openId" class="px-4 py-2.5 whitespace-nowrap text-neutral-600">{{ formatDate(u.created_at) }}</td>
          </tr>
          <template v-if="!result">
            <tr v-for="i in 6" :key="i">
              <td v-for="j in openId ? 3 : 6" :key="j" class="px-4 py-3.5"><div class="h-3 animate-pulse rounded bg-neutral-100" /></td>
            </tr>
          </template>
        </tbody>
      </table>
    </div>

    <Pagination v-if="result" v-model:page="page" class="mt-4" :total="result.total" :limit="LIMIT" />

    <template v-if="openId" #side>
      <AccountPanel :id="openId" @close="close" @changed="load" />
    </template>
  </AdminShell>
</template>
