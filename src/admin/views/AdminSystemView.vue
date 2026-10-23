<script setup lang="ts">
/**
 * The server at a glance: the database, the mail server, the Telegram bot
 * and the admins' alert bot checked on the spot, with a test alert; the
 * outgoing email, the build, and how this server's background jobs ran. It
 * checks again every 30 seconds while open.
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
import { fetchAdminSystem, sendTestAlert } from '../api'
import type { AdminCheck, AdminJob, AdminSystem } from '../types'

const { t, te } = useI18n()
const auth = useAuthStore()

const REFRESH_MS = 30_000
const system = ref<AdminSystem | null>(null)
const loading = ref(false)

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
const timer = setInterval(() => {
  if (!document.hidden && !loading.value) void load()
}, REFRESH_MS)
onBeforeUnmount(() => clearInterval(timer))

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
const BADGES: Record<State, string> = {
  ok: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  failing: 'bg-red-50 text-red-700 ring-red-200',
  late: 'bg-amber-50 text-amber-700 ring-amber-200',
  waiting: 'bg-neutral-100 text-neutral-600 ring-neutral-200',
  off: 'bg-neutral-100 text-neutral-600 ring-neutral-200',
}

/** The worst of the services: what the page's headline says. */
const overall = computed<'ok' | 'failing' | null>(() => {
  if (!system.value) return null
  const bad = system.value.checks.some((c) => c.state === 'failing') || system.value.jobs.some((j) => j.state === 'failing' || j.state === 'late')
  return bad ? 'failing' : 'ok'
})

/** A job's name in the reader's language; one the panel doesn't know shows as the server names it. */
function jobName(name: string): string {
  const key = `admin.system.jobNames.${name.replace(/ /g, '_')}`
  return te(key) ? t(key) : name
}

/** "5 s", "15 min", "1 h". */
function every(seconds: number): string {
  if (seconds % 3600 === 0) return t('admin.system.every.h', { n: seconds / 3600 })
  if (seconds % 60 === 0) return t('admin.system.every.min', { n: seconds / 60 })
  return t('admin.system.every.s', { n: seconds })
}

const dateTime = computed(() => new Intl.DateTimeFormat(intlLocale(), { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }))
</script>

<template>
  <AdminShell :title="$t('nav.adminSystem')" :description="$t('admin.system.description')">
    <template #actions>
      <BaseButton variant="ghost" size="sm" :block="false" :loading="loading" @click="load()">{{ $t('admin.system.refresh') }}</BaseButton>
    </template>

    <section>
      <h2 class="flex items-center gap-2 text-sm font-semibold text-neutral-900">
        {{ $t('admin.system.services') }}
        <span v-if="overall" class="h-2 w-2 rounded-full" :class="DOTS[overall]" aria-hidden="true" />
      </h2>
      <div class="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <template v-if="system">
          <div v-for="c in system.checks" :key="c.name" class="rounded-xl border border-neutral-200 px-4 py-3">
            <div class="flex items-start justify-between gap-2">
              <p class="text-sm font-medium text-neutral-900">{{ $t(`admin.system.checks.${c.name}`) }}</p>
              <span class="inline-flex shrink-0 items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ring-inset" :class="BADGES[c.state]">
                <span class="h-1.5 w-1.5 rounded-full" :class="DOTS[c.state]" aria-hidden="true" />
                {{ $t(`admin.system.state.${c.state}`) }}
              </span>
            </div>
            <template v-if="c.state === 'off'">
              <p v-if="$t(`admin.system.off.${c.name}`)" class="mt-2 text-xs text-neutral-500">{{ $t(`admin.system.off.${c.name}`) }}</p>
            </template>
            <p v-else class="mt-2 text-xs text-neutral-500 tabular-nums">{{ $t('admin.system.latency', { ms: c.latency_ms }) }}</p>
            <p v-if="c.error" class="mt-1 font-mono text-xs break-words text-red-600">{{ c.error }}</p>
            <button
              v-if="c.name === 'alerts' && c.state !== 'off'"
              type="button"
              class="mt-1.5 text-xs font-semibold text-neutral-900 underline-offset-2 hover:underline disabled:opacity-50"
              :disabled="testing"
              @click="testAlert"
            >
              {{ $t('admin.system.testAlert') }}
            </button>
          </div>
        </template>
        <template v-else>
          <div v-for="i in 4" :key="i" class="h-[4.5rem] animate-pulse rounded-xl border border-neutral-200 bg-neutral-50" />
        </template>
      </div>
    </section>

    <div class="mt-6 grid gap-3 sm:grid-cols-2">
      <section class="rounded-xl border border-neutral-200 px-4 py-3">
        <div class="flex items-center justify-between gap-2">
          <h2 class="text-sm font-semibold text-neutral-900">{{ $t('admin.system.emails') }}</h2>
          <RouterLink
            :to="system?.emails.failed ? { path: '/admin/emails', query: { status: 'failed' } } : '/admin/emails'"
            class="text-xs font-medium text-neutral-500 hover:text-neutral-900 hover:underline"
          >
            {{ $t('admin.system.openEmails') }}
          </RouterLink>
        </div>
        <dl class="mt-2 grid grid-cols-3 gap-2">
          <div v-for="s in (['queued', 'failed', 'sent'] as const)" :key="s">
            <dt class="text-xs text-neutral-500">{{ $t(`admin.emails.counts.${s}`) }}</dt>
            <dd class="mt-0.5 text-xl font-semibold tabular-nums" :class="s === 'failed' && system?.emails.failed ? 'text-red-600' : 'text-neutral-900'">
              {{ system ? system.emails[s] : '–' }}
            </dd>
          </div>
        </dl>
        <p v-if="system" class="mt-1 text-xs text-neutral-500">
          {{ system.emails.last_sent ? $t('admin.emails.lastSent', { when: timeAgo(system.emails.last_sent) }) : $t('admin.emails.noneSent') }}
        </p>
      </section>

      <section class="rounded-xl border border-neutral-200 px-4 py-3">
        <h2 class="text-sm font-semibold text-neutral-900">{{ $t('admin.system.build') }}</h2>
        <dl class="mt-2 space-y-1.5 text-sm">
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
            <dd class="text-neutral-900 tabular-nums">{{ system ? dateTime.format(new Date(system.started_at)) : '–' }}</dd>
          </div>
        </dl>
      </section>
    </div>

    <section class="mt-6">
      <h2 class="text-sm font-semibold text-neutral-900">{{ $t('admin.system.jobs') }}</h2>
      <p class="text-xs text-neutral-500">{{ $t('admin.system.jobsHint') }}</p>
      <div class="mt-3 overflow-x-auto rounded-xl border border-neutral-200 transition-opacity" :class="loading && system ? 'opacity-60' : ''">
        <table class="w-full min-w-[40rem] text-left text-sm">
          <thead class="border-b border-neutral-200 bg-neutral-50 text-xs text-neutral-500">
            <tr>
              <th scope="col" class="px-4 py-2.5 font-medium">{{ $t('admin.system.columns.job') }}</th>
              <th scope="col" class="px-4 py-2.5 font-medium">{{ $t('admin.system.columns.every') }}</th>
              <th scope="col" class="px-4 py-2.5 font-medium">{{ $t('admin.system.columns.lastRun') }}</th>
              <th scope="col" class="px-4 py-2.5 text-right font-medium">{{ $t('admin.system.columns.runs') }}</th>
              <th scope="col" class="w-64 px-4 py-2.5 font-medium">{{ $t('admin.system.columns.state') }}</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-neutral-100">
            <tr v-for="j in system?.jobs ?? []" :key="j.name" class="align-top">
              <td class="px-4 py-2.5 font-medium text-neutral-900">{{ jobName(j.name) }}</td>
              <td class="px-4 py-2.5 whitespace-nowrap text-neutral-600 tabular-nums">{{ every(j.interval_seconds) }}</td>
              <td class="px-4 py-2.5 whitespace-nowrap text-neutral-600">
                <template v-if="j.running">{{ $t('admin.system.running') }}</template>
                <template v-else-if="j.last_run">{{ timeAgo(j.last_run) }}</template>
                <template v-else>–</template>
              </td>
              <td class="px-4 py-2.5 text-right text-neutral-600 tabular-nums">{{ j.runs }}</td>
              <td class="px-4 py-2.5">
                <span class="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ring-inset" :class="BADGES[j.state]">
                  <span class="h-1.5 w-1.5 rounded-full" :class="DOTS[j.state]" aria-hidden="true" />
                  {{ $t(`admin.system.state.${j.state}`) }}
                </span>
                <span v-if="j.failures" class="ml-2 text-xs text-neutral-500">{{ $t('admin.system.failures', { n: j.failures }) }}</span>
                <p v-if="j.last_error" class="mt-1 font-mono text-xs break-words text-red-600">{{ j.last_error }}</p>
              </td>
            </tr>
            <tr v-if="system && !system.jobs.length">
              <td colspan="5" class="px-4 py-6 text-center text-sm text-neutral-500">{{ $t('admin.system.noJobs') }}</td>
            </tr>
            <template v-if="!system">
              <tr v-for="i in 5" :key="i">
                <td v-for="k in 5" :key="k" class="px-4 py-3.5"><div class="h-3 animate-pulse rounded bg-neutral-100" /></td>
              </tr>
            </template>
          </tbody>
        </table>
      </div>
    </section>
  </AdminShell>
</template>
