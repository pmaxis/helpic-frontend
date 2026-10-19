<script setup lang="ts">
/**
 * The start page: what needs attention today and how the work and the money
 * stand. A strip of key numbers (money for the freelancer and the client
 * company's owner, never for team members), then "Focus" — the week's due
 * dates and the open tasks that matter most — with recent activity, beside
 * the projects' progress and the latest reports.
 */
import { computed, onMounted, ref } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import DashboardLayout from '@/layouts/DashboardLayout.vue'
import PageHeader from '@/components/ui/PageHeader.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import StatusBadge from '@/components/tasks/StatusBadge.vue'
import PriorityIcon from '@/components/tasks/PriorityIcon.vue'
import AvatarStack from '@/components/tasks/AvatarStack.vue'
import TaskFormModal from '@/components/tasks/TaskFormModal.vue'
import { useAuthStore } from '@/stores/auth'
import { useTasksStore } from '@/stores/tasks'
import { useProjectsStore } from '@/stores/projects'
import { useReportsStore } from '@/stores/reports'
import { usePeopleStore } from '@/stores/people'
import { formatDate, isOverdue, timeAgo } from '@/utils/format'
import { formatMoney } from '@/utils/money'
import { toast } from '@/composables/useToasts'
import { useI18n } from 'vue-i18n'
import { columnName } from '@/constants/tasks'
import { intlLocale } from '@/i18n'
import type { Task, TaskPriority } from '@/types/tasks'
import type { Report } from '@/types/reports'

const auth = useAuthStore()
const tasks = useTasksStore()
const projects = useProjectsStore()
const reports = useReportsStore()
const people = usePeopleStore()
const router = useRouter()
const loaded = ref(false)

/** The money is the freelancer's and the client company owner's; team members don't see reports. */
const seesMoney = computed(() => auth.isFreelancer || auth.isTeamOwner)

onMounted(async () => {
  try {
    await Promise.all([
      tasks.fetchTasks(),
      projects.fetchProjects(),
      seesMoney.value ? reports.fetchReports() : Promise.resolve(),
      auth.isClient ? people.fetchFreelancers() : people.fetchClients(),
    ])
  } catch {
    toast.error(tr('dashboard.loadFailed'))
  } finally {
    loaded.value = true
  }
})

// --- days ------------------------------------------------------------------------

const DAY = 24 * 60 * 60 * 1000

/** YYYY-MM-DD for a day offset from today, in local time. */
function dayISO(offset: number): string {
  const d = new Date(Date.now() + offset * DAY)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// tr, not t: t is a task in the functions below.
const { t: tr, locale } = useI18n()

const today = computed(() => locale.value && new Date().toLocaleDateString(intlLocale(), { weekday: 'long', day: 'numeric', month: 'long' }))

// --- tasks -----------------------------------------------------------------------

function isOpen(t: Task) {
  return t.status === 'new' || t.status === 'in_progress'
}

const open = computed(() => tasks.tasks.filter(isOpen))
const overdue = computed(() => open.value.filter((t) => isOverdue(t.due_on)))
const inProgress = computed(() => tasks.tasks.filter((t) => t.status === 'in_progress'))
const doneThisWeek = computed(
  () => tasks.tasks.filter((t) => t.status === 'done' && Date.now() - new Date(t.updated_at).getTime() < 7 * DAY).length,
)

/** The coming week, today first, with how many open tasks fall due each day. */
const week = computed(() =>
  Array.from({ length: 7 }, (_, i) => {
    const iso = dayISO(i)
    const d = new Date(Date.now() + i * DAY)
    return {
      iso,
      weekday: i === 0 ? tr('dashboard.today') : d.toLocaleDateString(intlLocale(), { weekday: 'short' }),
      day: d.getDate(),
      count: open.value.filter((t) => t.due_on === iso).length,
    }
  }),
)

/** A day picked in the week strip narrows Focus to it; picking it again shows everything. */
const pickedDay = ref('')

const PRIORITY_RANK: Record<TaskPriority, number> = { urgent: 0, high: 1, medium: 2, low: 3, none: 4 }

/** What to work on: overdue first, then by due date, then by priority; undated last. */
const focus = computed(() => {
  const list = pickedDay.value ? open.value.filter((t) => t.due_on === pickedDay.value) : open.value
  return [...list]
    .sort((a, b) => {
      const ao = isOverdue(a.due_on) ? 0 : 1
      const bo = isOverdue(b.due_on) ? 0 : 1
      if (ao !== bo) return ao - bo
      if (a.due_on !== b.due_on) return (a.due_on ?? '9999').localeCompare(b.due_on ?? '9999')
      return PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority]
    })
    .slice(0, 7)
})

function dueChip(t: Task): { text: string; tone: string } | null {
  if (!t.due_on) return null
  if (isOverdue(t.due_on)) return { text: tr('dashboard.overdueOn', { date: formatDate(t.due_on) }), tone: 'bg-red-50 text-red-700 ring-red-600/20' }
  if (t.due_on === dayISO(0)) return { text: tr('dashboard.today'), tone: 'bg-amber-50 text-amber-800 ring-amber-600/20' }
  if (t.due_on === dayISO(1)) return { text: tr('dashboard.tomorrow'), tone: 'bg-sky-50 text-sky-700 ring-sky-600/20' }
  return { text: formatDate(t.due_on), tone: 'bg-neutral-50 text-neutral-600 ring-neutral-500/20' }
}

function where(t: Task): string {
  if (t.project) return t.project.name
  const other = auth.isClient ? t.freelancer : t.client
  if (other) return other.name || other.email
  return t.client ? '' : tr('dashboard.personal')
}

const recent = computed(() => [...tasks.tasks].sort((a, b) => b.updated_at.localeCompare(a.updated_at)).slice(0, 6))

const activeProjects = computed(() =>
  [...projects.projects]
    .filter((p) => p.total_tasks > 0)
    .sort((a, b) => b.open_tasks - a.open_tasks || a.name.localeCompare(b.name))
    .slice(0, 5),
)

function progress(p: { open_tasks: number; total_tasks: number }): number {
  return Math.round(((p.total_tasks - p.open_tasks) / p.total_tasks) * 100)
}

// --- money -----------------------------------------------------------------------

/** Sums reports' totals by currency, the largest first. */
function sumByCurrency(list: Report[]): { cents: number; currency: string }[] {
  const sums = new Map<string, number>()
  for (const r of list) if (r.total_cents) sums.set(r.currency, (sums.get(r.currency) ?? 0) + r.total_cents)
  return [...sums].map(([currency, cents]) => ({ currency, cents })).sort((a, b) => b.cents - a.cents)
}

function moneyText(sums: { cents: number; currency: string }[]): string {
  if (!sums.length) return formatMoney(0, auth.user?.currency || sums[0]?.currency || 'USD')
  return formatMoney(sums[0].cents, sums[0].currency)
}

const thisMonth = dayISO(0).slice(0, 7)
const awaiting = computed(() => reports.reports.filter((r) => r.status === 'sent'))
const paidThisMonth = computed(() => reports.reports.filter((r) => r.status === 'paid' && r.paid_at?.startsWith(thisMonth)))
const awaitingSums = computed(() => sumByCurrency(awaiting.value))
const paidSums = computed(() => sumByCurrency(paidThisMonth.value))

const latestReports = computed(() => reports.reports.slice(0, 4))

const REPORT_TONE: Record<string, string> = {
  draft: 'bg-neutral-100 text-neutral-600 ring-neutral-500/20',
  sent: 'bg-sky-50 text-sky-700 ring-sky-600/20',
  paid: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
}

// --- the strip of numbers ------------------------------------------------------------

type Tone = 'neutral' | 'red' | 'sky' | 'emerald' | 'amber'
interface Stat {
  label: string
  value: string
  hint: string
  to: string
  icon: 'open' | 'overdue' | 'progress' | 'done' | 'awaiting' | 'earned'
  tone: Tone
}

const stats = computed<Stat[]>(() => {
  const openStat: Stat = {
    label: tr('dashboard.stats.open'),
    value: String(open.value.length),
    hint: tr('dashboard.stats.inProgressCount', { n: inProgress.value.length }),
    to: '/tasks',
    icon: 'open',
    tone: 'neutral',
  }
  const overdueStat: Stat = {
    label: tr('dashboard.stats.overdue'),
    value: String(overdue.value.length),
    hint: overdue.value.length ? tr('dashboard.stats.pastDue') : tr('dashboard.stats.nothingLate'),
    to: '/tasks',
    icon: 'overdue',
    tone: overdue.value.length ? 'red' : 'neutral',
  }
  const doneStat: Stat = {
    label: tr('dashboard.stats.doneWeek'),
    value: String(doneThisWeek.value),
    hint: tr('dashboard.stats.last7'),
    to: '/tasks?status=done',
    icon: 'done',
    tone: 'emerald',
  }
  if (auth.isFreelancer) {
    return [
      openStat,
      overdueStat,
      {
        label: tr('dashboard.stats.awaiting'),
        value: moneyText(awaitingSums.value),
        hint: awaiting.value.length ? tr('dashboard.stats.sentReports', { n: awaiting.value.length }, awaiting.value.length) : tr('dashboard.stats.noSent'),
        to: '/reports',
        icon: 'awaiting',
        tone: 'sky',
      },
      {
        label: tr('dashboard.stats.earned'),
        value: moneyText(paidSums.value),
        hint: paidThisMonth.value.length
          ? tr('dashboard.stats.paidReports', { n: paidThisMonth.value.length }, paidThisMonth.value.length)
          : tr('dashboard.stats.nothingPaid'),
        to: '/reports',
        icon: 'earned',
        tone: 'emerald',
      },
    ]
  }
  if (auth.isTeamOwner) {
    return [
      openStat,
      overdueStat,
      {
        label: tr('dashboard.stats.toPay'),
        value: moneyText(awaitingSums.value),
        hint: awaiting.value.length ? tr('dashboard.stats.reportsToPay', { n: awaiting.value.length }, awaiting.value.length) : tr('dashboard.stats.nothingToPay'),
        to: '/reports',
        icon: 'awaiting',
        tone: 'sky',
      },
      doneStat,
    ]
  }
  return [
    openStat,
    { ...openStat, label: tr('dashboard.stats.inProgress'), value: String(inProgress.value.length), hint: tr('dashboard.stats.beingWorkedOn'), icon: 'progress', tone: 'amber' },
    overdueStat,
    doneStat,
  ]
})

const TONES: Record<Tone, { chip: string; value: string }> = {
  neutral: { chip: 'bg-neutral-100 text-neutral-600', value: 'text-neutral-900' },
  red: { chip: 'bg-red-50 text-red-600', value: 'text-red-600' },
  sky: { chip: 'bg-sky-50 text-sky-600', value: 'text-neutral-900' },
  emerald: { chip: 'bg-emerald-50 text-emerald-600', value: 'text-neutral-900' },
  amber: { chip: 'bg-amber-50 text-amber-600', value: 'text-neutral-900' },
}

// --- the header --------------------------------------------------------------------

const greeting = computed(() => {
  const h = new Date().getHours()
  const part = tr(`dashboard.greeting.${h < 12 ? 'morning' : h < 18 ? 'afternoon' : 'evening'}`)
  const name = auth.user?.name.split(/\s+/)[0]
  return name ? tr('dashboard.greetingNamed', { part, name }) : part
})

const summary = computed(() => {
  if (!loaded.value) return today.value
  const o = open.value.length
  const parts = [tr('dashboard.openTasks', { n: o }, o)]
  parts.push(overdue.value.length ? tr('dashboard.overdueCount', { n: overdue.value.length }) : tr('dashboard.nothingOverdue'))
  const dueToday = week.value[0].count
  if (dueToday) parts.push(tr('dashboard.dueToday', { n: dueToday }))
  return `${today.value} — ${parts.join(' · ')}`
})

const creating = ref(false)
const counterparts = computed(() => (auth.isClient ? people.freelancers : people.clients))

function onCreated(t: Task) {
  creating.value = false
  void router.push({ name: 'task-detail', params: { id: t.id } })
}

const card = 'rounded-xl border border-neutral-200 bg-white'
</script>

<template>
  <DashboardLayout>
    <PageHeader :title="greeting" :description="summary">
      <template #actions>
        <BaseButton size="sm" :block="false" @click="creating = true">{{ $t('tasks.newTask') }}</BaseButton>
      </template>
    </PageHeader>

    <!-- key numbers -->
    <div class="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <RouterLink
        v-for="s in stats"
        :key="s.label"
        :to="s.to"
        class="group flex items-start gap-3.5 rounded-xl border border-neutral-200 bg-white p-4 transition hover:-translate-y-px hover:border-neutral-300 hover:shadow-sm"
        :class="s.tone === 'red' ? 'border-red-200 bg-red-50/40' : ''"
      >
        <span class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg" :class="TONES[s.tone].chip" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-[18px] w-[18px]">
            <template v-if="s.icon === 'open'"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></template>
            <template v-else-if="s.icon === 'overdue'"><path d="M12 9v4M12 17h.01" /><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" /></template>
            <template v-else-if="s.icon === 'progress'"><path d="M21 12a9 9 0 1 1-6.2-8.6" /><path d="M21 4v5h-5" /></template>
            <template v-else-if="s.icon === 'done'"><path d="M22 11.1V12a10 10 0 1 1-5.9-9.1" /><polyline points="22 4 12 14 9 11" /></template>
            <template v-else-if="s.icon === 'awaiting'"><rect x="2" y="5" width="20" height="14" rx="2" /><path d="M2 10h20M6 15h4" /></template>
            <template v-else><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></template>
          </svg>
        </span>
        <div class="min-w-0">
          <p class="text-sm text-neutral-500">{{ s.label }}</p>
          <p class="mt-0.5 truncate text-2xl font-semibold tracking-tight tabular-nums" :class="TONES[s.tone].value">{{ loaded ? s.value : '–' }}</p>
          <p class="mt-0.5 truncate text-xs text-neutral-400">{{ s.hint }}</p>
        </div>
      </RouterLink>
    </div>

    <div class="mt-6 grid gap-6 lg:grid-cols-3">
      <div class="space-y-6 lg:col-span-2">
        <!-- focus: the week and what to work on -->
        <section :class="card" aria-labelledby="dash-focus">
          <header class="flex items-center justify-between px-5 pt-4">
            <h2 id="dash-focus" class="text-sm font-semibold text-neutral-900">{{ $t('dashboard.focus') }}</h2>
            <RouterLink to="/tasks" class="text-xs text-neutral-500 hover:text-neutral-900">{{ $t('dashboard.allTasks') }}</RouterLink>
          </header>

          <!-- the week, a day picks the list -->
          <div class="mt-3 grid grid-cols-7 gap-1.5 px-5" role="group" :aria-label="$t('dashboard.dueThisWeek')">
            <button
              v-for="d in week"
              :key="d.iso"
              type="button"
              class="flex flex-col items-center rounded-lg py-2 text-xs transition-colors"
              :class="
                pickedDay === d.iso
                  ? 'bg-neutral-900 text-white'
                  : d.count
                    ? 'bg-neutral-50 text-neutral-700 ring-1 ring-neutral-200 ring-inset hover:bg-neutral-100'
                    : 'text-neutral-400 hover:bg-neutral-50'
              "
              :aria-pressed="pickedDay === d.iso"
              :aria-label="$t('dashboard.dayDue', { weekday: d.weekday, day: d.day, n: d.count })"
              @click="pickedDay = pickedDay === d.iso ? '' : d.iso"
            >
              <span class="font-medium">{{ d.weekday }}</span>
              <span class="mt-0.5 text-base font-semibold tabular-nums" :class="pickedDay === d.iso ? 'text-white' : d.count ? 'text-neutral-900' : ''">{{ d.day }}</span>
              <span class="mt-1 flex h-1.5 gap-0.5" aria-hidden="true">
                <span v-for="n in Math.min(d.count, 3)" :key="n" class="h-1.5 w-1.5 rounded-full" :class="pickedDay === d.iso ? 'bg-white' : 'bg-amber-500'" />
              </span>
            </button>
          </div>

          <ul v-if="focus.length" class="mt-3 divide-y divide-neutral-100 border-t border-neutral-100">
            <li v-for="t in focus" :key="t.id">
              <RouterLink :to="{ name: 'task-detail', params: { id: t.id } }" class="flex items-center gap-3 px-5 py-2.5 transition-colors hover:bg-neutral-50">
                <PriorityIcon :priority="t.priority" show-none />
                <div class="min-w-0 flex-1">
                  <p class="truncate text-sm font-medium text-neutral-900">{{ t.title }}</p>
                  <p class="truncate text-xs text-neutral-500">{{ where(t) }} · {{ columnName(t.status_name) }}</p>
                </div>
                <span
                  v-if="dueChip(t)"
                  class="shrink-0 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap ring-1 ring-inset"
                  :class="dueChip(t)?.tone"
                >
                  {{ dueChip(t)?.text }}
                </span>
              </RouterLink>
            </li>
          </ul>
          <div v-else class="mt-3 border-t border-neutral-100 px-5 py-8 text-center">
            <p class="text-sm text-neutral-500">
              {{ !loaded ? $t('common.loading') : pickedDay ? $t('dashboard.nothingThatDay') : open.length ? '' : $t('dashboard.allCaughtUp') }}
            </p>
            <button v-if="pickedDay" type="button" class="mt-1 text-xs font-medium text-neutral-700 hover:text-neutral-900" @click="pickedDay = ''">
              {{ $t('dashboard.showEveryOpen') }}
            </button>
          </div>
        </section>

        <!-- what happened lately -->
        <section :class="card" aria-labelledby="dash-recent">
          <header class="px-5 pt-4 pb-2">
            <h2 id="dash-recent" class="text-sm font-semibold text-neutral-900">{{ $t('dashboard.recent') }}</h2>
          </header>
          <ul v-if="recent.length" class="divide-y divide-neutral-100 border-t border-neutral-100">
            <li v-for="t in recent" :key="t.id">
              <RouterLink :to="{ name: 'task-detail', params: { id: t.id } }" class="flex items-center gap-3 px-5 py-2.5 transition-colors hover:bg-neutral-50">
                <AvatarStack :people="t.participants" :max="3" />
                <div class="min-w-0 flex-1">
                  <p class="truncate text-sm text-neutral-900">{{ t.title }}</p>
                  <p class="truncate text-xs text-neutral-400">{{ where(t) }} · {{ timeAgo(t.updated_at) }}</p>
                </div>
                <StatusBadge :status="t.status" :name="t.status_name" />
              </RouterLink>
            </li>
          </ul>
          <p v-else class="border-t border-neutral-100 px-5 py-8 text-center text-sm text-neutral-400">
            <template v-if="!loaded">{{ $t('common.loading') }}</template>
            <template v-else>
              {{ $t('dashboard.noTasks') }}
              <button type="button" class="font-medium text-neutral-700 underline-offset-4 hover:underline" @click="creating = true">{{ $t('dashboard.addFirst') }}</button>
            </template>
          </p>
        </section>
      </div>

      <div class="space-y-6">
        <!-- projects -->
        <section :class="card" aria-labelledby="dash-projects">
          <header class="flex items-center justify-between px-5 pt-4 pb-2">
            <h2 id="dash-projects" class="text-sm font-semibold text-neutral-900">{{ $t('dashboard.projects') }}</h2>
            <RouterLink to="/projects" class="text-xs text-neutral-500 hover:text-neutral-900">{{ $t('dashboard.all') }}</RouterLink>
          </header>
          <ul v-if="activeProjects.length" class="space-y-1 px-2 pb-3">
            <li v-for="p in activeProjects" :key="p.id">
              <RouterLink :to="{ name: 'project-detail', params: { id: p.id } }" class="block rounded-lg px-3 py-2.5 transition-colors hover:bg-neutral-50">
                <div class="flex items-baseline justify-between gap-3">
                  <p class="truncate text-sm font-medium text-neutral-900">{{ p.name }}</p>
                  <span class="shrink-0 text-xs font-medium text-neutral-500 tabular-nums">{{ progress(p) }}%</span>
                </div>
                <div class="mt-2 h-1.5 overflow-hidden rounded-full bg-neutral-100">
                  <div class="h-full rounded-full bg-emerald-500 transition-[width] duration-500" :style="{ width: `${progress(p)}%` }" />
                </div>
                <p class="mt-1.5 text-xs text-neutral-400">
                  {{ p.open_tasks ? $t('dashboard.openOf', { n: p.open_tasks }) : '' }}{{ $t('dashboard.closedOf', { closed: p.total_tasks - p.open_tasks, total: p.total_tasks }) }}
                </p>
              </RouterLink>
            </li>
          </ul>
          <p v-else class="px-5 pt-2 pb-6 text-sm text-neutral-400">
            <template v-if="!loaded">{{ $t('common.loading') }}</template>
            <template v-else>
              {{ $t('dashboard.noProjects') }}
              <RouterLink v-if="!auth.isContractor" to="/projects" class="font-medium text-neutral-700 underline-offset-4 hover:underline">{{
                $t('dashboard.createOne')
              }}</RouterLink>
            </template>
          </p>
        </section>

        <!-- reports: the freelancer's and the owner's -->
        <section v-if="seesMoney" :class="card" aria-labelledby="dash-reports">
          <header class="flex items-center justify-between px-5 pt-4 pb-2">
            <h2 id="dash-reports" class="text-sm font-semibold text-neutral-900">{{ $t('dashboard.reports') }}</h2>
            <RouterLink to="/reports" class="text-xs text-neutral-500 hover:text-neutral-900">{{ $t('dashboard.all') }}</RouterLink>
          </header>
          <ul v-if="latestReports.length" class="space-y-1 px-2 pb-3">
            <li v-for="r in latestReports" :key="r.id">
              <RouterLink :to="{ name: 'report-detail', params: { id: r.id } }" class="flex items-center gap-3 rounded-lg px-3 py-2 transition-colors hover:bg-neutral-50">
                <div class="min-w-0 flex-1">
                  <p class="truncate text-sm font-medium text-neutral-900">{{ r.title }}</p>
                  <p class="truncate text-xs text-neutral-400">
                    {{ r.total_cents !== null ? formatMoney(r.total_cents, r.currency) : $t('dashboard.tasksCount', { n: r.item_count }, r.item_count) }}
                  </p>
                </div>
                <span class="shrink-0 rounded-full px-2 py-0.5 text-xs font-medium capitalize ring-1 ring-inset" :class="REPORT_TONE[r.status]">
                  {{ $t(`dashboard.reportStatus.${r.status === 'draft' && !r.client ? 'personal' : r.status}`) }}
                </span>
              </RouterLink>
            </li>
          </ul>
          <p v-else class="px-5 pt-2 pb-6 text-sm text-neutral-400">{{ loaded ? $t('dashboard.noReports') : $t('common.loading') }}</p>
        </section>
      </div>
    </div>

    <TaskFormModal v-if="creating" :people="counterparts" @close="creating = false" @saved="onCreated" />
  </DashboardLayout>
</template>
