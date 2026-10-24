<script setup lang="ts">
/**
 * The outgoing email, the newest first, a page at a time: search, a status
 * filter and the counts. An email that wasn't sent can be sent again. Only
 * whom to and the subject show: the text can hold one-time links.
 */
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import BaseInput from '@/components/ui/BaseInput.vue'
import SelectInput from '@/components/ui/SelectInput.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import MailIllustration from '@/components/illustrations/MailIllustration.vue'
import Pagination from '@/components/ui/Pagination.vue'
import { toast } from '@/composables/useToasts'
import { intlLocale } from '@/i18n'
import { timeAgo } from '@/utils/format'
import { useAuthStore } from '@/stores/auth'
import AdminShell from '../components/AdminShell.vue'
import { fetchAdminEmails, retryEmail } from '../api'
import type { AdminEmail, AdminEmailStatus, AdminEmailsPage } from '../types'

const { t } = useI18n()
const auth = useAuthStore()
const route = useRoute()

/** How many tries the server makes before giving up on an email. */
const MAX_ATTEMPTS = 8
const LIMIT = 10
const STATUSES: (AdminEmailStatus | '')[] = ['', 'queued', 'failed', 'sent']
const statusOptions = computed(() => STATUSES.map((s) => ({ value: s, label: t(`admin.emails.filter.${s || 'all'}`) })))

const query = ref('')
const status = ref<AdminEmailStatus | ''>(STATUSES.includes(route.query.status as AdminEmailStatus) ? (route.query.status as AdminEmailStatus) : '')
const page = ref(1)
const result = ref<AdminEmailsPage | null>(null)
const loading = ref(false)
const retrying = ref<string | null>(null)
const emails = computed<AdminEmail[] | null>(() => result.value?.emails ?? null)

/** Answers that come back after a newer request was sent are dropped. */
let latest = 0

async function load() {
  if (!auth.canOpenAdmin) return
  const mine = ++latest
  loading.value = true
  try {
    const data = await fetchAdminEmails({ status: status.value, q: query.value.trim(), page: page.value, limit: LIMIT })
    if (mine === latest) result.value = data
  } catch {
    if (mine === latest) toast.error(t('admin.loadFailed'))
  } finally {
    if (mine === latest) loading.value = false
  }
}

// Typing waits for a pause; the status and the page load at once.
let typing: ReturnType<typeof setTimeout> | undefined
watch(query, () => {
  clearTimeout(typing)
  typing = setTimeout(() => {
    page.value = 1
    void load()
  }, 300)
})
watch(status, () => {
  page.value = 1
  void load()
})
watch(page, () => void load())
onBeforeUnmount(() => clearTimeout(typing))
void load()

async function retry(e: AdminEmail) {
  retrying.value = e.id
  try {
    await retryEmail(e.id)
    toast.success(t('admin.emails.retried'))
    await load()
  } catch {
    toast.error(t('admin.emails.failed'))
  } finally {
    retrying.value = null
  }
}

const timeFormat = computed(() => new Intl.DateTimeFormat(intlLocale(), { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }))

const TONES: Record<AdminEmailStatus, string> = {
  queued: 'bg-amber-50 text-amber-700 ring-amber-200',
  failed: 'bg-red-50 text-red-700 ring-red-200',
  sent: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
}
</script>

<template>
  <AdminShell :title="$t('nav.adminEmails')" :description="$t('admin.emails.description')" :fill="!!emails && !emails.length">
    <template #actions>
      <BaseButton variant="ghost" size="sm" :block="false" :loading="loading" @click="load()">{{ $t('admin.logs.refresh') }}</BaseButton>
    </template>

    <div class="grid gap-3 sm:grid-cols-3">
      <div v-for="s in (['queued', 'failed', 'sent'] as const)" :key="s" class="rounded-xl border border-neutral-200 px-4 py-3">
        <p class="text-xs text-neutral-500">{{ $t(`admin.emails.counts.${s}`) }}</p>
        <p class="mt-1 text-2xl font-semibold tabular-nums" :class="s === 'failed' && result?.counts.failed ? 'text-red-600' : 'text-neutral-900'">
          {{ result ? result.counts[s] : '–' }}
        </p>
        <p v-if="s === 'sent' && result" class="mt-0.5 text-xs text-neutral-500">
          {{ result.counts.last_sent ? $t('admin.emails.lastSent', { when: timeAgo(result.counts.last_sent) }) : $t('admin.emails.noneSent') }}
        </p>
      </div>
    </div>

    <div class="mt-4 flex flex-wrap items-end gap-3">
      <BaseInput v-model="query" :label="$t('admin.emails.search')" type="search" class="min-w-56 flex-1" />
      <SelectInput v-model="status" :options="statusOptions" class="w-44" :aria-label="$t('admin.emails.statusFilter')" />
    </div>

    <EmptyState v-if="emails && !emails.length" class="mt-6 flex-1 justify-center" :title="$t('admin.emails.empty')" :description="$t('admin.emails.emptyText')">
      <template #illustration>
        <MailIllustration />
      </template>
    </EmptyState>

    <div v-else class="mt-4 overflow-x-auto rounded-xl border border-neutral-200 transition-opacity" :class="loading && emails ? 'opacity-60' : ''">
      <table class="w-full min-w-[48rem] text-left text-sm">
        <thead class="border-b border-neutral-200 bg-neutral-50 text-xs text-neutral-500">
          <tr>
            <th scope="col" class="w-36 px-4 py-2.5 font-medium">{{ $t('admin.emails.columns.at') }}</th>
            <th scope="col" class="w-56 px-4 py-2.5 font-medium">{{ $t('admin.emails.columns.to') }}</th>
            <th scope="col" class="px-4 py-2.5 font-medium">{{ $t('admin.emails.columns.subject') }}</th>
            <th scope="col" class="w-48 px-4 py-2.5 font-medium">{{ $t('admin.emails.columns.status') }}</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-neutral-100">
          <tr v-for="e in emails ?? []" :key="e.id" class="align-top">
            <td class="px-4 py-2.5 whitespace-nowrap text-neutral-600 tabular-nums">{{ timeFormat.format(new Date(e.created_at)) }}</td>
            <td class="max-w-56 truncate px-4 py-2.5 font-medium text-neutral-900">{{ e.to }}</td>
            <td class="max-w-md min-w-64 px-4 py-2.5">
              <p class="truncate text-neutral-600">{{ e.subject }}</p>
              <p v-if="e.last_error && e.status !== 'sent'" class="mt-1 font-mono text-xs break-words text-red-600">{{ e.last_error }}</p>
            </td>
            <td class="px-4 py-2.5 whitespace-nowrap">
              <span class="inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ring-inset" :class="TONES[e.status]">
                {{ $t(`admin.emails.status.${e.status}`) }}
              </span>
              <p v-if="e.status === 'sent' && e.sent_at" class="mt-1 text-xs text-neutral-500 tabular-nums">{{ timeFormat.format(new Date(e.sent_at)) }}</p>
              <p v-else-if="e.attempts > 0" class="mt-1 text-xs text-neutral-500">{{ $t('admin.emails.attempts', { n: e.attempts, max: MAX_ATTEMPTS }) }}</p>
              <p v-if="e.status === 'queued' && e.attempts > 0" class="text-xs text-neutral-500 tabular-nums">
                {{ $t('admin.emails.nextTry', { when: timeFormat.format(new Date(e.next_attempt_at)) }) }}
              </p>
              <button
                v-if="e.status !== 'sent' && e.attempts > 0"
                type="button"
                class="mt-1.5 text-xs font-semibold text-neutral-900 underline-offset-2 hover:underline disabled:opacity-50"
                :disabled="retrying === e.id"
                @click="retry(e)"
              >
                {{ $t('admin.emails.retry') }}
              </button>
            </td>
          </tr>
          <template v-if="!emails">
            <tr v-for="i in 6" :key="i">
              <td v-for="j in 4" :key="j" class="px-4 py-3.5"><div class="h-3 animate-pulse rounded bg-neutral-100" /></td>
            </tr>
          </template>
        </tbody>
      </table>
    </div>

    <Pagination v-if="result && result.total" v-model:page="page" class="mt-4" :total="result.total" :limit="LIMIT" />
  </AdminShell>
</template>
