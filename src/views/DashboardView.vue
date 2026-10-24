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
import { useRouter } from 'vue-router'
import DashboardLayout from '@/layouts/DashboardLayout.vue'
import PageHeader from '@/components/ui/PageHeader.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import TaskFormModal from '@/components/tasks/TaskFormModal.vue'
import type { Month } from '@/components/dashboard/EarningsChart.vue'
import EarningsCard from '@/components/dashboard/EarningsCard.vue'
import ProjectsCard from '@/components/dashboard/ProjectsCard.vue'
import ReportsCard from '@/components/dashboard/ReportsCard.vue'
import WorkloadCard from '@/components/dashboard/WorkloadCard.vue'
import type { Slice } from '@/components/dashboard/WorkloadDonut.vue'
import PeopleCard, { type Person } from '@/components/dashboard/PeopleCard.vue'
import { useAuthStore } from '@/stores/auth'
import { useTasksStore } from '@/stores/tasks'
import { useProjectsStore } from '@/stores/projects'
import { useReportsStore } from '@/stores/reports'
import { usePeopleStore } from '@/stores/people'
import { isOverdue } from '@/utils/format'
import { toast } from '@/composables/useToasts'
import { useI18n } from 'vue-i18n'
import { columnName, statusLabel } from '@/constants/tasks'
import { intlLocale } from '@/i18n'
import type { Task, TaskPriority } from '@/types/tasks'

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
</script>

<template>
  <!-- on a wide screen the page is the window's height: the bottom row is fixed, the top one takes the rest -->
  <DashboardLayout fill>
    <PageHeader :title="greeting" :description="summary">
      <template #actions>
        <BaseButton size="sm" :block="false" @click="creating = true">{{ $t('tasks.newTask') }}</BaseButton>
      </template>
    </PageHeader>

    <!-- the money and the tasks at a glance -->
    <div v-if="seesMoney" class="mt-6 grid gap-4 lg:min-h-[19.5rem] lg:flex-1 lg:grid-cols-3">
      <EarningsCard :months="months" :currency="leadCurrency" :loaded="loaded" />

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
      <ProjectsCard :loaded="loaded" />
      <!-- reports: the freelancer's and the owner's -->
      <ReportsCard v-if="seesMoney" :loaded="loaded" />
    </div>

    <TaskFormModal v-if="creating" :people="counterparts" @close="creating = false" @saved="onCreated" />
  </DashboardLayout>
</template>
