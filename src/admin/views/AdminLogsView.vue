<script setup lang="ts">
/**
 * The server's warnings and errors, the newest first, a page at a time:
 * search, a level filter and the last day's counts. A row opens to show
 * everything that was logged with it.
 */
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import BaseInput from '@/components/ui/BaseInput.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import Pagination from '@/components/ui/Pagination.vue'
import { toast } from '@/composables/useToasts'
import { intlLocale } from '@/i18n'
import { useAuthStore } from '@/stores/auth'
import AdminShell from '../components/AdminShell.vue'
import { fetchAdminLogs } from '../api'
import type { AdminLog, AdminLogLevel, AdminLogsPage } from '../types'

const { t } = useI18n()
const auth = useAuthStore()

const LIMIT = 10
const LEVELS: AdminLogLevel[] = ['', 'warn', 'error']

const query = ref('')
const level = ref<AdminLogLevel>('')
const page = ref(1)
const result = ref<AdminLogsPage | null>(null)
const loading = ref(false)
const open = ref<number | null>(null)
const logs = computed<AdminLog[] | null>(() => result.value?.logs ?? null)

/** Answers that come back after a newer request was sent are dropped. */
let latest = 0

async function load() {
  if (!auth.canOpenAdmin) return
  const mine = ++latest
  loading.value = true
  try {
    const data = await fetchAdminLogs({ level: level.value, q: query.value.trim(), page: page.value, limit: LIMIT })
    if (mine !== latest) return
    result.value = data
    open.value = null
  } catch {
    if (mine === latest) toast.error(t('admin.loadFailed'))
  } finally {
    if (mine === latest) loading.value = false
  }
}

// Typing waits for a pause; the level and the page load at once.
let typing: ReturnType<typeof setTimeout> | undefined
watch(query, () => {
  clearTimeout(typing)
  typing = setTimeout(() => {
    page.value = 1
    void load()
  }, 300)
})
watch(level, () => {
  page.value = 1
  void load()
})
watch(page, () => void load())
onBeforeUnmount(() => clearTimeout(typing))
void load()

const timeFormat = computed(
  () => new Intl.DateTimeFormat(intlLocale(), { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', second: '2-digit' }),
)

/** The line under the message: the request it was, or what failed. */
function summary(log: AdminLog): string {
  const a = log.attrs
  const parts: string[] = []
  if (typeof a.route === 'string') parts.push([a.method, a.route].filter(Boolean).join(' '))
  if (a.status !== undefined) parts.push(`→ ${a.status}`)
  if (typeof a.job === 'string') parts.push(a.job)
  if (a.error !== undefined) parts.push(String(a.error))
  return parts.join(' · ')
}

function toggle(id: number) {
  open.value = open.value === id ? null : id
}
</script>

<template>
  <AdminShell :title="$t('nav.adminLogs')" :description="$t('admin.logs.description')">
    <template #actions>
      <BaseButton variant="ghost" size="sm" :block="false" :loading="loading" @click="load()">{{ $t('admin.logs.refresh') }}</BaseButton>
    </template>

    <div class="grid gap-3 sm:grid-cols-2">
      <div class="rounded-xl border border-neutral-200 px-4 py-3">
        <p class="text-xs text-neutral-500">{{ $t('admin.logs.errors') }}</p>
        <p class="mt-1 text-2xl font-semibold tabular-nums" :class="result?.errors ? 'text-red-600' : 'text-neutral-900'">{{ result ? result.errors : '–' }}</p>
      </div>
      <div class="rounded-xl border border-neutral-200 px-4 py-3">
        <p class="text-xs text-neutral-500">{{ $t('admin.logs.warnings') }}</p>
        <p class="mt-1 text-2xl font-semibold tabular-nums" :class="result?.warnings ? 'text-amber-600' : 'text-neutral-900'">{{ result ? result.warnings : '–' }}</p>
      </div>
    </div>

    <div class="mt-4 flex flex-wrap items-end gap-3">
      <BaseInput v-model="query" :label="$t('admin.logs.search')" type="search" class="min-w-56 flex-1" />
      <div class="inline-flex rounded-lg border border-neutral-200 bg-neutral-100 p-[3px] text-sm" role="group" :aria-label="$t('admin.logs.levelFilter')">
        <button
          v-for="l in LEVELS"
          :key="l || 'all'"
          type="button"
          class="rounded-md px-2.5 py-1 font-medium transition-colors"
          :class="level === l ? 'bg-white text-neutral-900 shadow-xs' : 'text-neutral-500 hover:text-neutral-900'"
          :aria-pressed="level === l"
          @click="level = l"
        >
          {{ $t(`admin.logs.level.${l || 'all'}`) }}
        </button>
      </div>
    </div>

    <EmptyState v-if="logs && !logs.length" class="mt-6" :title="$t('admin.logs.empty')" :description="$t('admin.logs.emptyText')" />

    <div v-else class="mt-4 overflow-x-auto rounded-xl border border-neutral-200 transition-opacity" :class="loading && logs ? 'opacity-60' : ''">
      <table class="w-full min-w-[44rem] text-left text-sm">
        <thead class="border-b border-neutral-200 bg-neutral-50 text-xs text-neutral-500">
          <tr>
            <th scope="col" class="w-40 px-4 py-2.5 font-medium">{{ $t('admin.logs.columns.at') }}</th>
            <th scope="col" class="w-32 px-4 py-2.5 font-medium">{{ $t('admin.logs.columns.level') }}</th>
            <th scope="col" class="px-4 py-2.5 font-medium">{{ $t('admin.logs.columns.message') }}</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-neutral-100">
          <template v-for="log in logs ?? []" :key="log.id">
            <tr class="cursor-pointer align-top transition-colors hover:bg-neutral-50" :class="open === log.id ? 'bg-neutral-50' : ''" @click="toggle(log.id)">
              <td class="px-4 py-2.5 whitespace-nowrap text-neutral-600 tabular-nums">{{ timeFormat.format(new Date(log.at)) }}</td>
              <td class="px-4 py-2.5">
                <span
                  class="inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ring-inset"
                  :class="log.level === 'ERROR' ? 'bg-red-50 text-red-700 ring-red-200' : 'bg-amber-50 text-amber-700 ring-amber-200'"
                >
                  {{ $t(`admin.logs.levels.${log.level}`) }}
                </span>
              </td>
              <td class="max-w-0 px-4 py-2.5">
                <!-- the row's click is for the pointer; the message is the keyboard's way in -->
                <button
                  type="button"
                  class="block w-full min-w-0 text-left focus:outline-none focus-visible:underline"
                  :aria-expanded="open === log.id"
                  @click.stop="toggle(log.id)"
                >
                  <span class="block truncate font-medium text-neutral-900">{{ log.message }}</span>
                  <span v-if="summary(log)" class="block truncate font-mono text-xs text-neutral-500">{{ summary(log) }}</span>
                </button>
              </td>
            </tr>
            <tr v-if="open === log.id" class="bg-neutral-50">
              <td colspan="3" class="px-4 pb-4">
                <p class="mb-1.5 text-xs font-medium text-neutral-500">{{ $t('admin.logs.details') }}</p>
                <pre class="overflow-x-auto rounded-lg border border-neutral-200 bg-white p-3 font-mono text-xs leading-relaxed text-neutral-800">{{ JSON.stringify(log.attrs, null, 2) }}</pre>
              </td>
            </tr>
          </template>
          <template v-if="!logs">
            <tr v-for="i in 6" :key="i">
              <td v-for="j in 3" :key="j" class="px-4 py-3.5"><div class="h-3 animate-pulse rounded bg-neutral-100" /></td>
            </tr>
          </template>
        </tbody>
      </table>
    </div>

    <Pagination v-if="result" v-model:page="page" class="mt-4" :total="result.total" :limit="LIMIT" />
  </AdminShell>
</template>
