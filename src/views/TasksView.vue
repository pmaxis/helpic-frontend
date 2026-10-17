<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import DashboardLayout from '@/layouts/DashboardLayout.vue'
import PageHeader from '@/components/ui/PageHeader.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import SelectInput from '@/components/ui/SelectInput.vue'
import MultiSelectInput from '@/components/ui/MultiSelectInput.vue'
import TaskList from '@/components/tasks/TaskList.vue'
import TaskFormModal from '@/components/tasks/TaskFormModal.vue'
import KanbanBoard from '@/components/board/KanbanBoard.vue'
import ViewToggle from '@/components/ui/ViewToggle.vue'
import { useBoardStore } from '@/stores/board'
import { useTaskView } from '@/composables/useTaskView'
import { useAuthStore } from '@/stores/auth'
import { useTasksStore } from '@/stores/tasks'
import { usePeopleStore } from '@/stores/people'
import { useProjectsStore } from '@/stores/projects'
import { filterLabel as statusFilterLabel, STATUS_FILTERS } from '@/constants/tasks'
import { t } from '@/i18n'
import type { Task } from '@/types/tasks'
import type { BoardColumn } from '@/types/board'

const auth = useAuthStore()
const tasks = useTasksStore()
const board = useBoardStore()
const view = useTaskView()
const people = usePeopleStore()
const route = useRoute()
const router = useRouter()

const filter = ref(typeof route.query.status === 'string' ? route.query.status : 'open')
const filterLabel = computed(() => statusFilterLabel(filter.value))
const withId = ref(typeof route.query.with === 'string' ? route.query.with : '')
const showForm = ref(false)
/** The board column a task is being added from, if any. */
const newTaskColumn = ref<BoardColumn | null>(null)

function startTask(column: BoardColumn | null = null) {
  newTaskColumn.value = column
  showForm.value = true
}
const loadError = ref('')

/** The people on the other side: a freelancer's clients or a client's freelancers. */
const counterparts = computed(() => (auth.isClient ? people.freelancers : people.clients))
const counterpartOptions = computed(() => [
  { value: '', label: auth.isClient ? t('tasks.allFreelancers') : t('tasks.allTasks') },
  ...(auth.isFreelancer ? [{ value: 'personal', label: t('common.personal') }] : []),
  ...counterparts.value.map((p) => ({ value: p.id, label: p.name || p.email })),
])
/** A freelancer filters between personal tasks and any client; a client needs two freelancers. */
const showCounterpartFilter = computed(() => counterparts.value.length > (auth.isClient ? 1 : 0))

/**
 * A board belongs to one freelancer–client pair (or a freelancer's personal
 * work). A freelancer also has the all board — every task, the pairs' columns
 * merged by name — which is their default; a client opens their first
 * freelancer's board.
 */
const boardOptions = computed(() => [
  // A freelancer's every task on one board, the boards' columns merged by name.
  ...(auth.isFreelancer ? [{ value: 'all', label: t('tasks.allBoards') }, { value: 'personal', label: t('common.personal') }] : []),
  ...counterparts.value.map((p) => ({ value: p.id, label: p.name || p.email })),
])

const boardWith = computed(() => {
  if (boardOptions.value.some((o) => o.value === withId.value)) return withId.value
  return boardOptions.value[0]?.value ?? ''
})

/** Picking a board: "All boards" is the freelancer's default, so it leaves no ?with= behind. */
function pickBoard(value: string) {
  withId.value = value === 'all' ? '' : value
}

// --- the board's project filter ---------------------------------------------------

const projects = useProjectsStore()
/** Picked project IDs; "none" keeps the tasks outside any project. Empty shows them all. */
const boardProjects = ref<string[]>([])

/** The projects on the open board: every one on the all board, else the pair's. */
const projectOptions = computed(() => {
  const w = boardWith.value
  const own = projects.projects.filter((p) => {
    if (w === 'all') return true
    if (auth.isClient) return p.freelancer.id === w
    return w === 'personal' ? !p.client : p.client?.id === w
  })
  return [...own.map((p) => ({ value: p.id, label: p.name })), { value: 'none', label: t('common.noProject') }]
})

// A filter for another board's projects means nothing here.
watch(boardWith, () => {
  boardProjects.value = boardProjects.value.filter((id) => projectOptions.value.some((o) => o.value === id))
})

async function load() {
  loadError.value = ''
  try {
    if (view.value === 'board') {
      if (boardWith.value) await board.fetchBoard({ with: boardWith.value, projects: boardProjects.value })
    } else {
      const statuses = STATUS_FILTERS.find((f) => f.value === filter.value)?.statuses ?? []
      await tasks.fetchTasks({ statuses, with: withId.value })
    }
  } catch {
    loadError.value = t('tasks.loadFailed')
  }
}

watch([filter, withId], () => {
  void router.replace({
    query: { ...route.query, status: filter.value !== 'open' ? filter.value : undefined, with: withId.value || undefined },
  })
})
watch([filter, boardWith, view, boardProjects], () => void load())

onMounted(async () => {
  if (!projects.loaded) void projects.fetchProjects().catch(() => {})
  try {
    if (auth.isClient) await people.fetchFreelancers()
    else await people.fetchClients()
  } catch {
    // The filters just stay empty.
  }
  void load()
})

function onSaved(task: Task) {
  showForm.value = false
  newTaskColumn.value = null
  // On the board the new card shows up in its column; in the list, open the task.
  if (view.value === 'board') void load()
  else void router.push({ name: 'task-detail', params: { id: task.id } })
}
</script>

<template>
  <DashboardLayout :fill="view === 'board'">
    <PageHeader :title="$t('tasks.title')">
      <template #actions>
        <!-- the filters, then the view and the new task -->
        <template v-if="view === 'list'">
          <!-- framed like the view toggle, 32px like the buttons beside it -->
          <div class="inline-flex h-8 items-center rounded-lg border border-neutral-200 bg-neutral-100 p-[3px] text-sm" role="group" :aria-label="$t('tasks.statusAria')">
            <button
              v-for="f in STATUS_FILTERS"
              :key="f.value"
              type="button"
              class="inline-flex h-full items-center rounded-md px-2.5 font-medium transition-colors"
              :class="filter === f.value ? 'bg-white text-neutral-900 shadow-xs' : 'text-neutral-500 hover:text-neutral-900'"
              :aria-pressed="filter === f.value"
              @click="filter = f.value"
            >
              {{ statusFilterLabel(f.value) }}
            </button>
          </div>
          <SelectInput
            v-if="showCounterpartFilter"
            v-model="withId"
            :options="counterpartOptions"
            :aria-label="auth.isClient ? $t('tasks.freelancer') : $t('tasks.client')"
            size="sm"
            class="w-48"
          />
        </template>
        <template v-else>
          <MultiSelectInput
            v-if="projectOptions.length > 1"
            v-model="boardProjects"
            :label="$t('tasks.projects')"
            hide-label
            :placeholder="$t('tasks.allProjects')"
            :options="projectOptions"
            size="sm"
            class="w-48"
          />
          <SelectInput
            v-if="boardOptions.length > 1"
            :model-value="boardWith"
            :options="boardOptions"
            :aria-label="$t('tasks.boardAria')"
            size="sm"
            class="w-48"
            @update:model-value="pickBoard"
          />
        </template>
        <ViewToggle v-model="view" />
        <BaseButton size="sm" :block="false" @click="startTask()">{{ $t('tasks.newTask') }}</BaseButton>
      </template>
    </PageHeader>

    <p v-if="loadError" class="mt-6 text-sm text-red-600">{{ loadError }}</p>

    <template v-else-if="view === 'board'">
      <div v-if="!boardWith && people.freelancersLoaded" class="mt-6">
        <EmptyState
          :title="$t('tasks.noFreelancersTitle')"
          :description="$t('tasks.noFreelancersBoard')"
        />
      </div>
      <KanbanBoard v-else-if="boardWith" class="mt-5" @new-task="startTask" />
    </template>

    <div v-else-if="!tasks.isLoading && !tasks.tasks.length" class="mt-6">
      <EmptyState
        v-if="auth.isClient && people.freelancersLoaded && !people.freelancers.length"
        :title="$t('tasks.noFreelancersTitle')"
        :description="$t('tasks.noFreelancersTasks')"
      />
      <!-- a filter that hides tasks says so, rather than looking like there are none -->
      <EmptyState
        v-else-if="filter !== 'all'"
        :title="$t('tasks.noFiltered', { filter: filterLabel.toLowerCase() })"
        :description="filter === 'open' ? $t('tasks.allDoneOrCancelled') : $t('tasks.nothingMatches')"
      >
        <div class="flex items-center gap-4">
          <BaseButton size="sm" variant="ghost" :block="false" @click="filter = 'all'">{{ $t('tasks.showAll') }}</BaseButton>
          <BaseButton size="sm" :block="false" @click="startTask()">{{ $t('tasks.newTask') }}</BaseButton>
        </div>
      </EmptyState>
      <EmptyState v-else-if="auth.isClient" :title="$t('tasks.emptyTitle')" :description="$t('tasks.emptyClient')">
        <BaseButton size="sm" :block="false" @click="startTask()">{{ $t('tasks.newTask') }}</BaseButton>
      </EmptyState>
      <EmptyState
        v-else-if="!people.clients.length"
        :title="$t('tasks.noneYetTitle')"
        :description="$t('tasks.noneYetPersonal')"
      >
        <div class="flex items-center gap-4">
          <BaseButton size="sm" :block="false" @click="startTask()">{{ $t('tasks.newTask') }}</BaseButton>
          <RouterLink to="/clients" class="text-sm font-medium text-neutral-900 underline-offset-4 hover:underline">{{ $t('tasks.inviteClient') }}</RouterLink>
        </div>
      </EmptyState>
      <EmptyState v-else :title="$t('tasks.emptyTitle')" :description="$t('tasks.noneYetFreelancer')">
        <BaseButton size="sm" :block="false" @click="startTask()">{{ $t('tasks.newTask') }}</BaseButton>
      </EmptyState>
    </div>

    <TaskList v-else class="mt-5" :tasks="tasks.tasks" :loading="tasks.isLoading" />

    <TaskFormModal
      v-if="showForm"
      :people="counterparts"
      :person-id="(view === 'board' ? (boardWith === 'all' ? '' : boardWith) : withId) || undefined"
      :status-id="newTaskColumn?.id"
      :column-name="newTaskColumn?.name"
      @close="showForm = false"
      @saved="onSaved"
    />

  </DashboardLayout>
</template>
