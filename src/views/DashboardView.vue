<script setup lang="ts">
/**
 * The start page: what needs attention today and how the work and the money
 * stand. For the freelancer and the client company's owner it leads with one
 * figure — what was earned (or paid) this month, the months before as a line —
 * beside the Tasks card: today's tasks, or the tasks by status. Team members,
 * who don't see money, get the Tasks card at the side. Then the clients (or
 * the freelancers),
 * beside the projects' progress and the latest reports.
 */
import { computed, onMounted, ref } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import DashboardLayout from '@/layouts/DashboardLayout.vue'
import PageHeader from '@/components/ui/PageHeader.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import TaskFormModal from '@/components/tasks/TaskFormModal.vue'
import EarningsChart, { type Month } from '@/components/dashboard/EarningsChart.vue'
import WorkloadCard from '@/components/dashboard/WorkloadCard.vue'
import type { Slice } from '@/components/dashboard/WorkloadDonut.vue'
import ProgressRing from '@/components/dashboard/ProgressRing.vue'
import PeopleCard, { type Person } from '@/components/dashboard/PeopleCard.vue'
import NavIcon from '@/components/navigation/NavIcon.vue'
import { useAuthStore } from '@/stores/auth'
import { useTasksStore } from '@/stores/tasks'
import { useProjectsStore } from '@/stores/projects'
import { useReportsStore } from '@/stores/reports'
import { usePeopleStore } from '@/stores/people'
import { useAdminStore } from '@/admin/store'
import { isOverdue } from '@/utils/format'
import { formatMoney } from '@/utils/money'
import { toast } from '@/composables/useToasts'
import { useI18n } from 'vue-i18n'
import { columnName, statusLabel } from '@/constants/tasks'
import { intlLocale } from '@/i18n'
import type { Task, TaskPriority } from '@/types/tasks'
import type { Report } from '@/types/reports'

const auth = useAuthStore()
const tasks = useTasksStore()
const projects = useProjectsStore()
const reports = useReportsStore()
const people = usePeopleStore()
// The way into the admin panel is a button here, not a sidebar item.
const admin = useAdminStore()
void admin.load()
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

const today = computed(
  () =>
    locale.value &&
    new Date().toLocaleDateString(intlLocale(), {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    }),
)

// --- tasks -----------------------------------------------------------------------

function isOpen(t: Task) {
  return t.status === 'new' || t.status === 'in_progress'
}

const open = computed(() => tasks.tasks.filter(isOpen))
const overdue = computed(() => open.value.filter((t) => isOverdue(t.due_on)))
const inProgress = computed(() => tasks.tasks.filter((t) => t.status === 'in_progress'))
const doneThisWeek = computed(() => tasks.tasks.filter((t) => t.status === 'done' && Date.now() - new Date(t.updated_at).getTime() < 7 * DAY).length)

const PRIORITY_RANK: Record<TaskPriority, number> = {
  urgent: 0,
  high: 1,
  medium: 2,
  low: 3,
  none: 4,
}

/** Today's open tasks for the Tasks card, most urgent first. */
const todayTasks = computed(() =>
  open.value
    .filter((t) => t.due_on === dayISO(0))
    .sort((a, b) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority])
    .map((task) => ({
      task,
      sub: `${where(task)} · ${columnName(task.status_name)}`,
    })),
)

function where(t: Task): string {
  if (t.project) return t.project.name
  // A personal task's owner sits where the freelancer would: it's nobody else's.
  if (!t.client) return tr('dashboard.personal')
  const other = auth.isClient ? t.freelancer : t.client
  return other ? other.name || other.email : ''
}


const activeProjects = computed(() =>
  [...projects.projects]
    .filter((p) => p.total_tasks > 0)
    .sort((a, b) => b.open_tasks - a.open_tasks || a.name.localeCompare(b.name))
    .slice(0, 3),
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

const awaiting = computed(() => reports.reports.filter((r) => r.status === 'sent'))
const awaitingSums = computed(() => sumByCurrency(awaiting.value))

const latestReports = computed(() => reports.reports.slice(0, 3))

// --- the lead figure: paid by month -----------------------------------------------------

/** The currency the lead figure counts in: the user's own. */
const leadCurrency = computed(() => auth.user?.currency || 'USD')

/** The last six months, oldest first, with what was paid in each in that currency. */
const months = computed<Month[]>(() => {
  const now = new Date()
  return Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - 5 + i, 1)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const cents = reports.reports
      .filter((r) => r.status === 'paid' && r.currency === leadCurrency.value && r.paid_at?.startsWith(key))
      .reduce((sum, r) => sum + (r.total_cents ?? 0), 0)
    return {
      key,
      label: d.toLocaleDateString(intlLocale(), { month: 'short' }),
      name: d.toLocaleDateString(intlLocale(), {
        month: 'long',
        year: 'numeric',
      }),
      cents,
      current: i === 5,
    }
  })
})

/** This month against the last: the change in percent, or null when there's nothing to compare with. */
const change = computed(() => {
  const [prev, cur] = months.value.slice(-2)
  if (!prev.cents) return null
  return {
    pct: Math.round(((cur.cents - prev.cents) / prev.cents) * 100),
    month: prev.name.split(' ')[0],
  }
})

const REPORT_TONE: Record<string, { pill: string; icon: string }> = {
  draft: {
    pill: 'bg-neutral-100 text-neutral-600 ring-neutral-500/20',
    icon: 'bg-neutral-100 text-neutral-500',
  },
  sent: {
    pill: 'bg-sky-50 text-sky-700 ring-sky-600/20',
    icon: 'bg-sky-50 text-sky-600',
  },
  paid: {
    pill: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
    icon: 'bg-emerald-50 text-emerald-600',
  },
}

// --- the hero's side figures ----------------------------------------------------------

/** What's sent and not yet paid: to come in for the freelancer, to pay for the owner. */
const awaitingText = computed(() => {
  const top = awaitingSums.value[0]
  return formatMoney(top?.cents ?? 0, top?.currency ?? leadCurrency.value, {
    whole: true,
  })
})
const awaitingHint = computed(() => {
  const n = awaiting.value.length
  if (auth.isFreelancer) return n ? tr('dashboard.stats.sentReports', { n }, n) : tr('dashboard.stats.noSent')
  return n ? tr('dashboard.stats.reportsToPay', { n }, n) : tr('dashboard.stats.nothingToPay')
})

/** The six months together, in the lead currency. */
const halfYear = computed(() => months.value.reduce((s, m) => s + m.cents, 0))

// --- the people on the other side ---------------------------------------------------

/**
 * The clients (a client's freelancers) by what they brought — or were paid —
 * over the six months of the chart; by open tasks for those who don't see money.
 */
const peopleCards = computed<Person[]>(() => {
  const list = auth.isClient ? people.freelancers : people.clients
  return list
    .map((p) => {
      const mine = (t: Task) => (auth.isClient ? t.freelancer?.id : t.client?.id) === p.id
      const person: Person = { party: p, open: p.open_tasks, overdue: overdue.value.filter(mine).length, value: p.open_tasks }
      if (seesMoney.value) {
        const paid = reports.reports.filter(
          (r) => r.status === 'paid' && r.currency === leadCurrency.value && (auth.isClient ? r.freelancer.id : r.client?.id) === p.id,
        )
        person.series = months.value.map((m) => paid.filter((r) => r.paid_at?.startsWith(m.key)).reduce((sum, r) => sum + (r.total_cents ?? 0), 0))
        person.value = person.series.reduce((a, b) => a + b, 0)
      }
      return person
    })
    .sort((a, b) => b.value - a.value || b.open - a.open || a.party.name.localeCompare(b.party.name))
})

// --- the workload ring -----------------------------------------------------------------

const slices = computed<Slice[]>(() => [
  {
    key: 'new',
    label: statusLabel('new'),
    count: tasks.tasks.filter((t) => t.status === 'new').length,
    stroke: 'stroke-sky-500',
    dot: 'bg-sky-500',
  },
  {
    key: 'in_progress',
    label: statusLabel('in_progress'),
    count: inProgress.value.length,
    stroke: 'stroke-amber-500',
    dot: 'bg-amber-500',
  },
  {
    key: 'done',
    label: statusLabel('done'),
    count: tasks.tasks.filter((t) => t.status === 'done').length,
    stroke: 'stroke-emerald-500',
    dot: 'bg-emerald-500',
  },
])

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
  const dueToday = todayTasks.value.length
  if (dueToday) parts.push(tr('dashboard.dueToday', { n: dueToday }))
  return `${today.value} — ${parts.join(' · ')}`
})

const creating = ref(false)
const counterparts = computed(() => (auth.isClient ? people.freelancers : people.clients))

function onCreated(t: Task) {
  creating.value = false
  void router.push({ name: 'task-detail', params: { id: t.id } })
}

const card = 'rounded-2xl border border-neutral-200/80 bg-white shadow-[0_1px_2px_rgb(0_0_0/0.04)]'
</script>

<template>
  <!-- on a wide screen the page is the window's height: the bottom row is fixed, the top one takes the rest -->
  <DashboardLayout fill>
    <PageHeader :title="greeting" :description="summary">
      <template #actions>
        <RouterLink
          v-if="admin.isAdmin"
          :to="{ name: 'admin' }"
          class="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-neutral-200 bg-white text-neutral-500 shadow-xs transition-colors hover:bg-neutral-50 hover:text-neutral-900"
          :aria-label="$t('nav.admin')"
          :title="$t('nav.admin')"
        >
          <NavIcon name="admin" aria-hidden="true" />
        </RouterLink>
        <BaseButton size="sm" :block="false" @click="creating = true">{{ $t('tasks.newTask') }}</BaseButton>
      </template>
    </PageHeader>

    <!-- the money and the tasks at a glance -->
    <div v-if="seesMoney" class="mt-6 grid gap-4 lg:min-h-[19.5rem] lg:flex-1 lg:grid-cols-3">
      <section :class="[card, 'flex flex-col p-6 lg:col-span-2']" aria-labelledby="dash-lead">
        <div class="flex flex-wrap items-start justify-between gap-x-8 gap-y-5">
          <div class="min-w-0">
            <p id="dash-lead" class="text-sm text-neutral-500">
              {{ auth.isFreelancer ? $t('dashboard.lead.earned') : $t('dashboard.lead.paid') }}
            </p>
            <p class="mt-1.5 truncate text-5xl font-semibold tracking-tight text-neutral-900 tabular-nums">
              {{ loaded ? formatMoney(months[5].cents, leadCurrency, { whole: true }) : '–' }}
            </p>
            <p v-if="loaded && change" class="mt-3 flex items-center gap-2 text-sm">
              <!-- up is good for what's earned; for what's paid out it's neither -->
              <span
                class="inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ring-inset"
                :class="
                  !auth.isFreelancer
                    ? 'bg-neutral-100 text-neutral-700 ring-neutral-500/20'
                    : change.pct >= 0
                      ? 'bg-emerald-50 text-emerald-700 ring-emerald-600/20'
                      : 'bg-red-50 text-red-700 ring-red-600/20'
                "
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2.6"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  class="h-3 w-3"
                  aria-hidden="true"
                >
                  <path v-if="change.pct >= 0" d="M7 17 17 7M9 7h8v8" />
                  <path v-else d="M7 7l10 10M17 9v8H9" />
                </svg>
                {{ Math.abs(change.pct) }}%
              </span>
              <span class="text-neutral-500">{{ $t('dashboard.lead.vs', { month: change.month }) }}</span>
            </p>
          </div>

          <dl class="flex divide-x divide-neutral-200 overflow-hidden rounded-xl border border-neutral-200 bg-neutral-50/60">
            <RouterLink to="/reports" class="group block px-4 py-3 transition-colors hover:bg-neutral-100/70">
              <dt class="text-xs text-neutral-500">
                {{ auth.isFreelancer ? $t('dashboard.stats.awaiting') : $t('dashboard.stats.toPay') }}
              </dt>
              <dd class="mt-0.5 text-lg font-semibold text-neutral-900 tabular-nums">
                {{ loaded ? awaitingText : '–' }}
              </dd>
              <dd class="text-[11px] text-neutral-400 group-hover:text-neutral-500">
                {{ awaitingHint }}
              </dd>
            </RouterLink>
            <div class="px-4 py-3">
              <dt class="text-xs text-neutral-500">
                {{ $t('dashboard.lead.halfYear') }}
              </dt>
              <dd class="mt-0.5 text-lg font-semibold text-neutral-900 tabular-nums">
                {{ loaded ? formatMoney(halfYear, leadCurrency, { whole: true }) : '–' }}
              </dd>
              <dd class="text-[11px] text-neutral-400">
                {{ $t('dashboard.lead.halfYearHint') }}
              </dd>
            </div>
          </dl>
        </div>

        <div class="mt-6 min-h-32 flex-1">
          <EarningsChart :months="months" :currency="leadCurrency" :label="$t('dashboard.lead.chart')" :empty-text="loaded ? $t('dashboard.lead.none') : ''" />
        </div>
      </section>

      <WorkloadCard :slices="slices" :open="open.length" :overdue="overdue.length" :done-this-week="doneThisWeek" :loaded="loaded" :today="todayTasks" />
    </div>

    <!-- one row of three, a fixed height: three rows each fit, nothing stretches it -->
    <!-- team members' row leads with the Tasks card, which needs a little more -->
    <div class="mt-4 grid shrink-0 gap-4 md:grid-cols-2 lg:grid-cols-3 [&>*]:overflow-hidden" :class="seesMoney ? 'lg:auto-rows-[18rem]' : 'mt-6 lg:auto-rows-[20rem]'">
      <!-- team members have no money row: the tasks lead their row instead -->
      <WorkloadCard
        v-if="!seesMoney"
        :slices="slices"
        :open="open.length"
        :overdue="overdue.length"
        :done-this-week="doneThisWeek"
        :loaded="loaded"
        :today="todayTasks"
      />

      <!-- the people on the other side -->
      <PeopleCard
        :title="auth.isClient ? $t('dashboard.people.freelancers') : $t('dashboard.people.clients')"
        :caption="seesMoney ? (auth.isFreelancer ? $t('dashboard.people.byEarned') : $t('dashboard.people.byPaid')) : $t('dashboard.people.byOpen')"
        :to="auth.isClient ? '/freelancers' : '/clients'"
        :people="peopleCards"
        :currency="seesMoney ? leadCurrency : undefined"
        :loaded="loaded"
        :empty-text="auth.isClient ? $t('dashboard.people.noFreelancers') : $t('dashboard.people.noClients')"
        :add-text="auth.isFreelancer ? $t('dashboard.people.invite') : undefined"
      />
      <!-- projects -->
      <section :class="[card, 'flex flex-col']" aria-labelledby="dash-projects">
        <header class="flex items-start justify-between px-5 pt-5 pb-2">
          <div>
            <h2 id="dash-projects" class="text-sm font-semibold text-neutral-900">{{ $t('dashboard.projects') }}</h2>
            <p class="mt-0.5 text-xs text-neutral-500">{{ $t('dashboard.projectsCaption') }}</p>
          </div>
          <RouterLink to="/projects" class="text-xs text-neutral-500 hover:text-neutral-900">{{ $t('dashboard.all') }}</RouterLink>
        </header>
        <ul v-if="activeProjects.length" class="px-2 pb-3">
          <li v-for="p in activeProjects" :key="p.id">
            <RouterLink
              :to="{ name: 'project-detail', params: { id: p.id } }"
              class="flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-neutral-50"
            >
              <ProgressRing :percent="progress(p)" />
              <div class="min-w-0 flex-1">
                <p class="truncate text-sm font-medium text-neutral-900">
                  {{ p.name }}
                </p>
                <p class="truncate text-xs text-neutral-500">
                  <template v-if="p.open_tasks">{{ $t('dashboard.openOf', { n: p.open_tasks }) }}</template>
                  {{
                    $t('dashboard.closedOf', {
                      closed: p.total_tasks - p.open_tasks,
                      total: p.total_tasks,
                    })
                  }}
                </p>
              </div>
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
                class="h-4 w-4 shrink-0 text-neutral-300"
                aria-hidden="true"
              >
                <path d="m9 18 6-6-6-6" />
              </svg>
            </RouterLink>
          </li>
        </ul>
        <p v-else class="flex flex-1 items-center justify-center px-5 pt-2 pb-8 text-center text-sm text-neutral-400">
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
      <section v-if="seesMoney" :class="[card, 'flex flex-col']" aria-labelledby="dash-reports">
        <header class="flex items-start justify-between px-5 pt-5 pb-2">
          <div>
            <h2 id="dash-reports" class="text-sm font-semibold text-neutral-900">{{ $t('dashboard.reports') }}</h2>
            <p class="mt-0.5 text-xs text-neutral-500">{{ $t('dashboard.reportsCaption') }}</p>
          </div>
          <RouterLink to="/reports" class="text-xs text-neutral-500 hover:text-neutral-900">{{ $t('dashboard.all') }}</RouterLink>
        </header>
        <ul v-if="latestReports.length" class="px-2 pb-3">
          <li v-for="r in latestReports" :key="r.id">
            <RouterLink
              :to="{ name: 'report-detail', params: { id: r.id } }"
              class="flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-neutral-50"
            >
              <span class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl" :class="REPORT_TONE[r.status].icon" aria-hidden="true">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  class="h-[18px] w-[18px]"
                >
                  <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
                  <path d="M14 3v5h5M9 13h6M9 17h4" />
                </svg>
              </span>
              <div class="min-w-0 flex-1">
                <p class="truncate text-sm font-medium text-neutral-900">
                  {{ r.title }}
                </p>
                <span class="mt-0.5 inline-block rounded-full px-1.5 py-px text-[11px] font-medium ring-1 ring-inset" :class="REPORT_TONE[r.status].pill">
                  {{ $t(`dashboard.reportStatus.${r.status === 'draft' && !r.client ? 'personal' : r.status}`) }}
                </span>
              </div>
              <p class="shrink-0 text-sm font-semibold text-neutral-900 tabular-nums">
                {{ r.total_cents !== null ? formatMoney(r.total_cents, r.currency) : $t('dashboard.tasksCount', { n: r.item_count }, r.item_count) }}
              </p>
            </RouterLink>
          </li>
        </ul>
        <p v-else class="flex flex-1 items-center justify-center px-5 pt-2 pb-8 text-center text-sm text-neutral-400">
          {{ loaded ? $t('dashboard.noReports') : $t('common.loading') }}
        </p>
      </section>
    </div>

    <TaskFormModal v-if="creating" :people="counterparts" @close="creating = false" @saved="onCreated" />
  </DashboardLayout>
</template>
