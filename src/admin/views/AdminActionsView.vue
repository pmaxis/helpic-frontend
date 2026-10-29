<script setup lang="ts">
/**
 * What admins did to accounts, the newest first, a page at a time. An
 * account still there opens in the accounts list.
 */
import { computed, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'
import { useI18n } from 'vue-i18n'
import EmptyState from '@/components/ui/EmptyState.vue'
import HistoryIllustration from '@/components/illustrations/HistoryIllustration.vue'
import Pagination from '@/components/ui/Pagination.vue'
import { toast } from '@/composables/useToasts'
import { intlLocale } from '@/i18n'
import { useAuthStore } from '@/stores/auth'
import AdminShell from '../components/AdminShell.vue'
import { fetchAdminActions } from '../api'
import type { AdminAction, AdminActionsPage } from '../types'

const { t } = useI18n()
const auth = useAuthStore()

const LIMIT = 10
const page = ref(1)
const result = ref<AdminActionsPage | null>(null)
const loading = ref(false)

async function load() {
  if (!auth.canOpenAdmin) return
  loading.value = true
  try {
    result.value = await fetchAdminActions({ page: page.value, limit: LIMIT })
  } catch {
    toast.error(t('admin.loadFailed'))
  } finally {
    loading.value = false
  }
}
watch(page, load)
void load()

const timeFormat = computed(
  () => new Intl.DateTimeFormat(intlLocale(), { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
)

const TONES: Record<AdminAction['action'], string> = {
  block: 'bg-red-50 text-red-700 ring-red-200',
  unblock: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  end_sessions: 'bg-amber-50 text-amber-700 ring-amber-200',
  reset_two_factor: 'bg-amber-50 text-amber-700 ring-amber-200',
  retry_email: 'bg-sky-50 text-sky-700 ring-sky-200',
  resend_signup: 'bg-sky-50 text-sky-700 ring-sky-200',
  delete_signup: 'bg-neutral-100 text-neutral-700 ring-neutral-200',
  end_session: 'bg-amber-50 text-amber-700 ring-amber-200',
  clear_limit: 'bg-sky-50 text-sky-700 ring-sky-200',
  lock_admin: 'bg-red-50 text-red-700 ring-red-200',
  unlock_admin: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  reset_admin: 'bg-amber-50 text-amber-700 ring-amber-200',
  delete: 'bg-red-50 text-red-700 ring-red-200',
}
</script>

<template>
  <AdminShell :title="$t('nav.adminActions')" :description="$t('admin.actions.description')" :fill="!!result && !result.actions.length">
    <EmptyState v-if="result && !result.actions.length" class="flex-1 justify-center" :title="$t('admin.actions.empty')" :description="$t('admin.actions.emptyText')">
      <template #illustration>
        <HistoryIllustration />
      </template>
    </EmptyState>

    <div v-else class="overflow-x-auto rounded-xl border border-neutral-200 transition-opacity" :class="loading && result ? 'opacity-60' : ''">
      <table class="w-full min-w-[48rem] text-left text-sm">
        <thead class="border-b border-neutral-200 bg-neutral-50 text-xs text-neutral-500">
          <tr>
            <th scope="col" class="w-44 px-4 py-2.5 font-medium">{{ $t('admin.actions.columns.at') }}</th>
            <th scope="col" class="px-4 py-2.5 font-medium">{{ $t('admin.actions.columns.action') }}</th>
            <th scope="col" class="px-4 py-2.5 font-medium">{{ $t('admin.actions.columns.account') }}</th>
            <th scope="col" class="px-4 py-2.5 font-medium">{{ $t('admin.actions.columns.admin') }}</th>
            <th scope="col" class="px-4 py-2.5 font-medium">{{ $t('admin.actions.columns.reason') }}</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-neutral-100">
          <tr v-for="a in result?.actions ?? []" :key="a.id" class="align-top">
            <td class="px-4 py-2.5 whitespace-nowrap text-neutral-600 tabular-nums">{{ timeFormat.format(new Date(a.at)) }}</td>
            <td class="px-4 py-2.5">
              <span class="inline-flex rounded-full px-2 py-0.5 text-xs font-semibold whitespace-nowrap ring-1 ring-inset" :class="TONES[a.action]">
                {{ $t(`admin.actions.names.${a.action}`) }}
              </span>
            </td>
            <td class="max-w-56 px-4 py-2.5">
              <RouterLink
                v-if="a.target_id"
                :to="{ path: '/admin/users', query: { account: a.target_id } }"
                class="block truncate font-medium text-neutral-900 hover:underline"
              >
                {{ a.target_email }}
              </RouterLink>
              <span v-else class="block truncate text-neutral-500">{{ a.target_email }}</span>
            </td>
            <td class="max-w-48 truncate px-4 py-2.5 text-neutral-600">{{ a.admin_email }}</td>
            <td class="max-w-72 px-4 py-2.5 break-words text-neutral-600">
              {{ a.action === 'clear_limit' && a.reason ? $t(`admin.limits.scopes.${a.reason}`) : a.reason || '–' }}
            </td>
          </tr>
          <template v-if="!result">
            <tr v-for="i in 5" :key="i">
              <td v-for="j in 5" :key="j" class="px-4 py-3.5"><div class="h-3 animate-pulse rounded bg-neutral-100" /></td>
            </tr>
          </template>
        </tbody>
      </table>
    </div>

    <Pagination v-if="result && result.total" v-model:page="page" class="mt-4" :total="result.total" :limit="LIMIT" />
  </AdminShell>
</template>
