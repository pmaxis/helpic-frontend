<script setup lang="ts">
/**
 * The server at a glance: the database, the mail server, the Telegram bot
 * and the admins' alert bot checked on the spot (with a test alert), the
 * outgoing email, the build, the files on tasks against the quota and the
 * disk, and how this server's background jobs ran and when each runs next.
 * It checks again every 30 seconds while open.
 */
import { computed, onBeforeUnmount, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { useI18n } from 'vue-i18n'
import BaseButton from '@/components/ui/BaseButton.vue'
import { toast } from '@/composables/useToasts'
import { intlLocale } from '@/i18n'
import { timeAgo } from '@/utils/format'
import { useAuthStore } from '@/stores/auth'
import AdminShell from '../components/AdminShell.vue'
import { meterClass, meterWidth, share } from '../storage'
import { formatSize } from '@/services/attachments'
import { fetchAdminSystem, sendTestAlert } from '../api'
import type { AdminCheck, AdminJob, AdminSystem } from '../types'

const { t, te } = useI18n()
const auth = useAuthStore()

const REFRESH_MS = 30_000
const system = ref<AdminSystem | null>(null)
const loading = ref(false)
/** Ticks every second, so the times under the jobs count down. */
const now = ref(Date.now())

async function load() {
  if (!auth.canOpenAdmin) return
  loading.value = true
  try {
    system.value = await fetchAdminSystem()
  } catch {
    toast.error(t('admin.loadFailed'))
  } finally {
    loading.value = false
  }
}
void load()
const refresher = setInterval(() => {
  if (!document.hidden && !loading.value) void load()
}, REFRESH_MS)
const clock = setInterval(() => (now.value = Date.now()), 1000)
onBeforeUnmount(() => {
  clearInterval(refresher)
  clearInterval(clock)
})

const testing = ref(false)

async function testAlert() {
  testing.value = true
  try {
    await sendTestAlert()
    toast.success(t('admin.system.testSent'))
  } catch {
    toast.error(t('admin.system.testFailed'))
  } finally {
    testing.value = false
  }
}

type State = AdminCheck['state'] | AdminJob['state']

const DOTS: Record<State, string> = {
  ok: 'bg-emerald-500',
  failing: 'bg-red-500',
  late: 'bg-amber-500',
  waiting: 'bg-neutral-300',
  off: 'bg-neutral-300',
}
const TEXT: Record<State, string> = {
  ok: 'text-emerald-700',
  failing: 'text-red-700',
  late: 'text-amber-700',
  waiting: 'text-neutral-500',
  off: 'text-neutral-500',
}

/** What isn't working, for the dot by the heading: failing services, and jobs that fail or fall behind. */
const problems = computed(() => {
  if (!system.value) return 0
  return system.value.checks.filter((c) => c.state === 'failing').length + system.value.jobs.filter((j) => j.state === 'failing' || j.state === 'late').length
})

/** A job's name in the reader's language; one the panel doesn't know shows as the server names it. */
function jobName(name: string): string {
  const key = `admin.system.jobNames.${name.replace(/ /g, '_')}`
  return te(key) ? t(key) : name
}

/** "5 s", "15 min", "1 h 30 min", "2 d 4 h": the two largest units. */
function span(seconds: number): string {
  const s = Math.max(0, Math.round(seconds))
  const d = Math.floor(s / 86400)
  const h = Math.floor((s % 86400) / 3600)
  const m = Math.floor((s % 3600) / 60)
  const parts: string[] = []
  if (d) parts.push(t('admin.system.every2.d', { n: d }))
  if (h) parts.push(t('admin.system.every.h', { n: h }))
  if (m && !d) parts.push(t('admin.system.every.min', { n: m }))
  if (!parts.length) parts.push(t('admin.system.every.s', { n: s % 60 }))
  return parts.slice(0, 2).join(' ')
}

const uptime = computed(() => (system.value ? span((now.value - new Date(system.value.started_at).getTime()) / 1000) : ''))

/** When the job runs again: "next in 40 s", or any moment now. */
function nextRun(j: AdminJob): string {
  if (!j.last_run || j.running) return ''
  const left = (new Date(j.last_run).getTime() + j.interval_seconds * 1000 - now.value) / 1000
  return left > 1 ? t('admin.system.nextRun', { when: span(left) }) : t('admin.system.nextRunSoon')
}

/** How full the files' disk is, 0…1; null when the server can't read it. */
const diskShare = computed(() => {
  const d = system.value?.storage.disk
  return d && d.total_bytes ? (d.total_bytes - d.free_bytes) / d.total_bytes : null
})

const dateTime = computed(() => new Intl.DateTimeFormat(intlLocale(), { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }))
</script>

<template>
  <AdminShell :title="$t('nav.adminSystem')" :description="$t('admin.system.description')">
    <template #actions>
      <BaseButton variant="ghost" size="sm" :block="false" :loading="loading" @click="load()">{{ $t('admin.system.refresh') }}</BaseButton>
    </template>

    <!-- the services, checked on the spot -->
    <section>
      <h2 class="flex items-center gap-2 text-sm font-semibold text-neutral-900">
        {{ $t('admin.system.services') }}
        <span v-if="system" class="h-2 w-2 rounded-full" :class="problems ? 'bg-red-500' : 'bg-emerald-500'" aria-hidden="true" />
      </h2>
      <div class="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <template v-if="system">
          <div
            v-for="c in system.checks"
            :key="c.name"
            class="flex flex-col rounded-xl border px-4 py-3.5"
            :class="c.state === 'failing' ? 'border-red-200' : 'border-neutral-200'"
          >
            <div class="flex items-center gap-3">
              <span
                class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
                :class="c.state === 'off' ? 'bg-neutral-100 text-neutral-400' : c.state === 'failing' ? 'bg-red-50 text-red-600' : 'bg-neutral-100 text-neutral-700'"
                aria-hidden="true"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-[18px] w-[18px]">
                  <template v-if="c.name === 'database'">
                    <ellipse cx="12" cy="5.5" rx="7" ry="2.5" />
                    <path d="M5 5.5v13c0 1.4 3.1 2.5 7 2.5s7-1.1 7-2.5v-13M5 12c0 1.4 3.1 2.5 7 2.5s7-1.1 7-2.5" />
                  </template>
                  <template v-else-if="c.name === 'mail'">
                    <rect x="3" y="5" width="18" height="14" rx="2" />
                    <path d="m3 7 9 6 9-6" />
                  </template>
                  <template v-else-if="c.name === 'telegram'">
                    <path d="m21 4-18 7.5 6 2 2 6 3.5-4 5 3.5z" />
                    <path d="m9 13.5 7-5" />
                  </template>
                  <template v-else>
                    <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
                    <path d="M10.3 21a1.9 1.9 0 0 0 3.4 0" />
                  </template>
                </svg>
              </span>
              <div class="min-w-0">
                <p class="text-sm leading-snug font-medium text-neutral-900">{{ $t(`admin.system.checks.${c.name}`) }}</p>
                <p class="truncate text-xs text-neutral-500">{{ $t(`admin.system.hints.${c.name}`) }}</p>
              </div>
            </div>
            <div class="mt-3 flex items-center justify-between gap-2 text-xs">
              <span class="inline-flex items-center gap-1.5 font-semibold" :class="TEXT[c.state]">
                <span class="h-2 w-2 rounded-full" :class="DOTS[c.state]" aria-hidden="true" />
                {{ $t(`admin.system.state.${c.state}`) }}
              </span>
              <span v-if="c.state !== 'off'" class="text-neutral-500 tabular-nums">{{ $t('admin.system.latency', { ms: c.latency_ms }) }}</span>
            </div>
            <p v-if="c.state === 'off' && $t(`admin.system.off.${c.name}`)" class="mt-2 text-xs text-neutral-500">{{ $t(`admin.system.off.${c.name}`) }}</p>
            <p v-if="c.error" class="mt-2 rounded-md bg-red-50 px-2 py-1.5 font-mono text-[11px] break-words text-red-700">{{ c.error }}</p>
            <button
              v-if="c.name === 'alerts' && c.state !== 'off'"
              type="button"
              class="mt-2 self-start text-xs font-semibold text-neutral-900 underline-offset-2 hover:underline disabled:opacity-50"
              :disabled="testing"
              @click="testAlert"
            >
              {{ $t('admin.system.testAlert') }}
            </button>
          </div>
        </template>
        <template v-else>
          <div v-for="i in 4" :key="i" class="h-[6.5rem] animate-pulse rounded-xl border border-neutral-200 bg-neutral-50" />
        </template>
      </div>
    </section>

    <div class="mt-6 grid gap-3 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
      <!-- the outgoing email -->
      <section class="rounded-xl border border-neutral-200">
        <div class="flex items-center justify-between gap-2 px-4 pt-3.5">
          <h2 class="text-sm font-semibold text-neutral-900">{{ $t('admin.system.emails') }}</h2>
          <RouterLink
            :to="system?.emails.failed ? { path: '/admin/emails', query: { status: 'failed' } } : '/admin/emails'"
            class="text-xs font-medium text-neutral-500 hover:text-neutral-900 hover:underline"
          >
            {{ $t('admin.system.openEmails') }} →
          </RouterLink>
        </div>
        <dl class="mt-3 grid grid-cols-3 divide-x divide-neutral-100 border-y border-neutral-100">
          <div v-for="s in (['queued', 'failed', 'sent'] as const)" :key="s" class="px-4 py-3">
            <dt class="text-xs text-neutral-500">{{ $t(`admin.emails.counts.${s}`) }}</dt>
            <dd
              class="mt-1 text-2xl font-semibold tabular-nums"
              :class="s === 'failed' && system?.emails.failed ? 'text-red-600' : s === 'queued' && system?.emails.queued ? 'text-amber-600' : 'text-neutral-900'"
            >
              {{ system ? system.emails[s] : '–' }}
            </dd>
          </div>
        </dl>
        <p class="px-4 py-2.5 text-xs text-neutral-500">
          <template v-if="system">
            {{ system.emails.last_sent ? $t('admin.emails.lastSent', { when: timeAgo(system.emails.last_sent) }) : $t('admin.emails.noneSent') }}
          </template>
        </p>
      </section>

      <!-- the build -->
      <section class="rounded-xl border border-neutral-200 px-4 py-3.5">
        <h2 class="text-sm font-semibold text-neutral-900">{{ $t('admin.system.build') }}</h2>
        <dl class="mt-3 space-y-2 text-sm">
          <div class="flex justify-between gap-3">
            <dt class="text-neutral-500">{{ $t('admin.system.version') }}</dt>
            <dd class="truncate font-mono text-neutral-900">{{ system?.version ?? '–' }}</dd>
          </div>
          <div class="flex justify-between gap-3">
            <dt class="text-neutral-500">Go</dt>
            <dd class="font-mono text-neutral-900">{{ system?.go_version ?? '–' }}</dd>
          </div>
          <div class="flex justify-between gap-3">
            <dt class="text-neutral-500">{{ $t('admin.system.started') }}</dt>
            <dd class="text-right text-neutral-900 tabular-nums">
              {{ system ? dateTime.format(new Date(system.started_at)) : '–' }}
              <span v-if="system" class="block text-xs text-neutral-500">{{ $t('admin.system.uptime', { time: uptime }) }}</span>
            </dd>
          </div>
        </dl>
      </section>
    </div>

    <!-- the files on tasks: how much they take, against the quota and the disk -->
    <section class="mt-6 rounded-xl border border-neutral-200">
      <div class="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 px-4 pt-3.5">
        <h2 class="text-sm font-semibold text-neutral-900">{{ $t('admin.storage.title') }}</h2>
        <p v-if="system" class="text-xs text-neutral-500">
          {{ system.storage.quota_bytes ? $t('admin.storage.limits', { quota: formatSize(system.storage.quota_bytes), file: formatSize(system.storage.max_file_bytes) }) : $t('admin.storage.limitsNoQuota', { file: formatSize(system.storage.max_file_bytes) }) }}
        </p>
      </div>
      <dl class="mt-3 grid grid-cols-2 divide-neutral-100 border-y border-neutral-100 max-sm:divide-y sm:grid-cols-4 sm:divide-x">
        <div class="px-4 py-3">
          <dt class="text-xs text-neutral-500">{{ $t('admin.storage.files') }}</dt>
          <dd class="mt-1 text-2xl font-semibold text-neutral-900 tabular-nums">{{ system ? system.storage.files : '–' }}</dd>
        </div>
        <div class="px-4 py-3">
          <dt class="text-xs text-neutral-500">{{ $t('admin.storage.taken') }}</dt>
          <dd class="mt-1 text-2xl font-semibold text-neutral-900 tabular-nums">{{ system ? formatSize(system.storage.bytes) : '–' }}</dd>
        </div>
        <div class="px-4 py-3">
          <dt class="text-xs text-neutral-500">{{ $t('admin.storage.accounts') }}</dt>
          <dd class="mt-1 text-2xl font-semibold text-neutral-900 tabular-nums">{{ system ? system.storage.accounts : '–' }}</dd>
        </div>
        <div class="px-4 py-3">
          <dt class="text-xs text-neutral-500">{{ $t('admin.storage.nearQuota') }}</dt>
          <dd class="mt-1 text-2xl font-semibold tabular-nums" :class="system?.storage.near_quota ? 'text-amber-600' : 'text-neutral-900'">
            {{ system ? (system.storage.quota_bytes ? system.storage.near_quota : '–') : '–' }}
          </dd>
        </div>
      </dl>

      <div class="grid gap-x-6 gap-y-4 px-4 py-3.5 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <!-- the disk the files are on -->
        <div>
          <h3 class="text-xs font-semibold text-neutral-900">{{ $t('admin.storage.disk') }}</h3>
          <template v-if="system?.storage.disk && diskShare !== null">
            <div
              class="mt-2 h-2 overflow-hidden rounded-full bg-neutral-100"
              role="meter"
              :aria-valuenow="system.storage.disk.total_bytes - system.storage.disk.free_bytes"
              aria-valuemin="0"
              :aria-valuemax="system.storage.disk.total_bytes"
              :aria-label="$t('admin.storage.disk')"
            >
              <div class="h-full rounded-full" :class="meterClass(diskShare)" :style="{ width: meterWidth(diskShare) }" />
            </div>
            <p class="mt-1.5 text-xs text-neutral-500 tabular-nums">
              {{ $t('admin.storage.diskFree', { free: formatSize(system.storage.disk.free_bytes), total: formatSize(system.storage.disk.total_bytes) }) }}
            </p>
          </template>
          <p v-else-if="system" class="mt-1 text-xs text-neutral-500">{{ $t('admin.storage.diskUnknown') }}</p>
        </div>

        <!-- who uploaded the most -->
        <div>
          <h3 class="text-xs font-semibold text-neutral-900">{{ $t('admin.storage.top') }}</h3>
          <p v-if="system && !system.storage.top.length" class="mt-1 text-xs text-neutral-500">{{ $t('admin.storage.none') }}</p>
          <ul v-else-if="system" class="mt-2 space-y-2.5">
            <li v-for="u in system.storage.top" :key="u.id">
              <div class="flex items-baseline justify-between gap-3 text-sm">
                <RouterLink :to="{ path: '/admin/users', query: { account: u.id } }" class="min-w-0 truncate font-medium text-neutral-900 hover:underline" :title="u.email">
                  {{ u.name || u.email }}
                </RouterLink>
                <span class="shrink-0 text-xs text-neutral-500 tabular-nums">
                  {{ $t('admin.storage.filesCount', { n: u.files }, u.files) }} · <span class="font-semibold text-neutral-900">{{ formatSize(u.bytes) }}</span>
                </span>
              </div>
              <div v-if="system.storage.quota_bytes" class="mt-1 h-1 overflow-hidden rounded-full bg-neutral-100" aria-hidden="true">
                <div class="h-full rounded-full" :class="meterClass(share(u.bytes, system.storage.quota_bytes))" :style="{ width: meterWidth(share(u.bytes, system.storage.quota_bytes)) }" />
              </div>
            </li>
          </ul>
        </div>
      </div>
    </section>

    <!-- the background jobs -->
    <section class="mt-6">
      <div class="flex items-baseline justify-between gap-3">
        <h2 class="text-sm font-semibold text-neutral-900">{{ $t('admin.system.jobs') }}</h2>
        <p class="text-xs text-neutral-500">{{ $t('admin.system.jobsHint') }}</p>
      </div>
      <ul class="mt-3 divide-y divide-neutral-100 rounded-xl border border-neutral-200 transition-opacity" :class="loading && system ? 'opacity-60' : ''">
        <li v-for="j in system?.jobs ?? []" :key="j.name" class="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3">
          <span class="relative flex h-2.5 w-2.5 shrink-0" aria-hidden="true">
            <span v-if="j.running" class="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
            <span class="relative inline-flex h-2.5 w-2.5 rounded-full" :class="DOTS[j.state]" />
          </span>
          <div class="min-w-0 flex-1">
            <p class="truncate text-sm font-medium text-neutral-900">{{ jobName(j.name) }}</p>
            <p class="text-xs text-neutral-500">
              {{ $t('admin.system.everyLabel', { n: span(j.interval_seconds) }) }} ·
              {{ $t('admin.system.runsCount', { n: j.runs }, j.runs) }}<template v-if="j.failures"> · <span class="text-red-600">{{ $t('admin.system.failures', { n: j.failures }) }}</span></template>
            </p>
          </div>
          <div class="text-right text-xs">
            <p class="font-semibold" :class="TEXT[j.state]">
              {{ j.running ? $t('admin.system.running') : $t(`admin.system.state.${j.state}`) }}
            </p>
            <p class="text-neutral-500 tabular-nums">
              <template v-if="j.last_run && !j.running">{{ timeAgo(j.last_run) }} · {{ nextRun(j) }}</template>
            </p>
          </div>
          <p v-if="j.last_error" class="w-full rounded-md bg-red-50 px-2 py-1.5 font-mono text-[11px] break-words text-red-700">{{ j.last_error }}</p>
        </li>
        <li v-if="system && !system.jobs.length" class="px-4 py-6 text-center text-sm text-neutral-500">{{ $t('admin.system.noJobs') }}</li>
        <template v-if="!system">
          <li v-for="i in 5" :key="i" class="px-4 py-3.5"><div class="h-4 animate-pulse rounded bg-neutral-100" /></li>
        </template>
      </ul>
    </section>
  </AdminShell>
</template>
