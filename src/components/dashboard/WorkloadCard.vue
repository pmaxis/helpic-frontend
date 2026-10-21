<script setup lang="ts">
/**
 * The tasks at a glance, two ways: "Today" — the first few tasks due today —
 * or "Overview" — the status ring. Under either, what's overdue and what got
 * done this week. Each status and tile opens those tasks.
 *
 * The view picked is remembered in this browser.
 */
import { ref, watch } from 'vue'
import { RouterLink } from 'vue-router'
import WorkloadDonut, { type Slice } from '@/components/dashboard/WorkloadDonut.vue'
import PriorityIcon from '@/components/tasks/PriorityIcon.vue'
import type { Task } from '@/types/tasks'

defineProps<{
  slices: Slice[]
  open: number
  overdue: number
  doneThisWeek: number
  loaded: boolean
  /** The open tasks due today, most urgent first, each with its line under the title. */
  today: { task: Task; sub: string }[]
}>()

/** How many of today's tasks the card has room for. */
const TODAY_SIZE = 3
const VIEW_KEY = 'helpic.dashboard.tasksView'

type View = 'today' | 'overview'

function storedView(): View {
  try {
    return localStorage.getItem(VIEW_KEY) === 'overview' ? 'overview' : 'today'
  } catch {
    return 'today'
  }
}

const view = ref<View>(storedView())
watch(view, (v) => {
  try {
    localStorage.setItem(VIEW_KEY, v)
  } catch {
    // the choice just isn't remembered
  }
})
</script>

<template>
  <section class="flex flex-col rounded-2xl border border-neutral-200/80 bg-white p-5 shadow-[0_1px_2px_rgb(0_0_0/0.04)]" aria-labelledby="dash-workload">
    <header class="flex items-start justify-between gap-3">
      <div class="min-w-0">
        <h2 id="dash-workload" class="text-sm font-semibold text-neutral-900">
          {{ $t('dashboard.workload.title') }}
        </h2>
        <p class="mt-0.5 truncate text-xs text-neutral-500">
          <template v-if="view === 'overview'">{{ $t('dashboard.workload.openCount', { n: open }, open) }}</template>
          <template v-else-if="today.length">
            {{ $t('dashboard.workload.dueToday', { n: today.length }, today.length) }}
            <!-- the ones that don't fit are on the tasks page -->
            <RouterLink v-if="today.length > TODAY_SIZE" to="/tasks" class="font-medium text-neutral-700 hover:text-neutral-900">
              · {{ $t('dashboard.workload.moreToday', { n: today.length - TODAY_SIZE }) }}
            </RouterLink>
          </template>
          <template v-else>{{ $t('dashboard.workload.noneToday') }}</template>
        </p>
      </div>
      <div class="flex shrink-0 rounded-lg bg-neutral-100 p-0.5 text-xs font-medium" role="group" :aria-label="$t('dashboard.workload.view')">
        <button
          v-for="v in ['today', 'overview'] as const"
          :key="v"
          type="button"
          class="rounded-md px-2.5 py-1 transition-colors"
          :class="view === v ? 'bg-white text-neutral-900 shadow-sm' : 'text-neutral-500 hover:text-neutral-900'"
          :aria-pressed="view === v"
          @click="view = v"
        >
          {{ $t(`dashboard.workload.views.${v}`) }}
        </button>
      </div>
    </header>

    <!-- the views sit in a box the row's height sets (on a wide screen the
         earnings card beside it does), so switching them never moves the row -->
    <div class="relative min-h-[10.5rem] flex-1 lg:min-h-0">
      <!-- today: the first few tasks due -->
      <div v-if="view === 'today'" class="flex h-full flex-col py-2 lg:absolute lg:inset-0">
        <ul v-if="today.length" class="-mx-2 space-y-0.5">
          <li v-for="i in today.slice(0, TODAY_SIZE)" :key="i.task.id">
            <RouterLink
              :to="{ name: 'task-detail', params: { id: i.task.id } }"
              class="flex items-center gap-2.5 rounded-lg px-2 py-1.5 transition-colors hover:bg-neutral-50"
            >
              <PriorityIcon :priority="i.task.priority" show-none />
              <div class="min-w-0 flex-1">
                <p class="truncate text-sm font-medium text-neutral-900">
                  {{ i.task.title }}
                </p>
                <p class="truncate text-xs text-neutral-500">{{ i.sub }}</p>
              </div>
            </RouterLink>
          </li>
        </ul>
        <div v-if="!today.length" class="flex flex-1 flex-col items-center justify-center text-center">
          <span class="mb-2 flex h-9 w-9 items-center justify-center rounded-full bg-emerald-50 text-emerald-600" aria-hidden="true">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2.2"
              stroke-linecap="round"
              stroke-linejoin="round"
              class="h-[18px] w-[18px]"
            >
              <path d="M20 6 9 17l-5-5" />
            </svg>
          </span>
          <p class="text-sm text-neutral-500">
            {{ loaded ? $t('dashboard.workload.nothingToday') : $t('common.loading') }}
          </p>
        </div>
      </div>

      <!-- overview: the tasks by status -->
      <div v-else class="flex h-full items-center py-4 lg:absolute lg:inset-0">
        <WorkloadDonut class="w-full" :slices="slices" :value="loaded ? String(open) : '–'" :caption="$t('dashboard.workload.open')" />
      </div>
    </div>

    <div class="grid grid-cols-2 gap-2">
      <RouterLink
        to="/tasks"
        class="rounded-xl px-3 py-2.5 transition-colors"
        :class="overdue ? 'bg-red-50 text-red-700 hover:bg-red-100/70' : 'bg-neutral-50 text-neutral-600 hover:bg-neutral-100'"
      >
        <p class="text-xl font-semibold tabular-nums">
          {{ loaded ? overdue : '–' }}
        </p>
        <p class="text-xs">{{ $t('dashboard.stats.overdue') }}</p>
      </RouterLink>
      <RouterLink to="/tasks?status=done" class="rounded-xl bg-emerald-50 px-3 py-2.5 text-emerald-800 transition-colors hover:bg-emerald-100/70">
        <p class="text-xl font-semibold tabular-nums">
          {{ loaded ? doneThisWeek : '–' }}
        </p>
        <p class="text-xs">{{ $t('dashboard.stats.doneWeek') }}</p>
      </RouterLink>
    </div>
  </section>
</template>
