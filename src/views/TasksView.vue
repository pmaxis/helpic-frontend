<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import DashboardLayout from '@/layouts/DashboardLayout.vue'
import PageHeader from '@/components/ui/PageHeader.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import SelectInput from '@/components/ui/SelectInput.vue'
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

// --- the board's project filter ---------------------------------------------------

const projects = useProjectsStore()
/** The one project whose tasks and columns are on screen. */
const projectId = ref('')

const projectOptions = computed(() => projects.projects.map((p) => ({ value: p.id, label: p.name })))

/** Keeps the open board on a project that still exists. */
function pickProject() {
  if (!projects.projects.some((p) => p.id === projectId.value)) {
    projectId.value = projects.projects[0]?.id ?? ''
  }
}

async function load() {
  loadError.value = ''
  try {
    if (view.value === 'board') {
      // A client with nobody to work with has no board yet.
      if (auth.isClient && !people.freelancers.length) return
      if (!projectId.value) return
      await board.fetchBoard({ project: projectId.value })
    } else {
      const statuses = STATUS_FILTERS.find((f) => f.value === filter.value)?.statuses ?? []
      await tasks.fetchTasks({ statuses, project: projectId.value || undefined })
    }
  } catch {
    loadError.value = t('tasks.loadFailed')
  }
}

watch(filter, () => {
  void router.replace({
    query: { ...route.query, status: filter.value !== 'open' ? filter.value : undefined, with: undefined },
  })
})
watch([filter, view, projectId], () => void load())

onMounted(async () => {
  try {
    if (!projects.loaded) await projects.fetchProjects()
  } catch {
    // The board stays empty until the projects load.
  }
  try {
    if (auth.isClient) await people.fetchFreelancers()
    else await people.fetchClients()
  } catch {
    // The new-task list just stays empty.
  }
  if (route.query.with) {
    void router.replace({ query: { ...route.query, with: undefined } })
  }
  const before = projectId.value
  pickProject()
  // Picking the first project reloads through the watch. Otherwise load once.
  if (projectId.value === before) void load()
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
        </template>
        <SelectInput
          v-if="projects.projects.length"
          v-model="projectId"
          :options="projectOptions"
          :aria-label="$t('tasks.projects')"
          size="sm"
          class="w-48"
        />
        <ViewToggle v-model="view" />
        <BaseButton size="sm" :block="false" @click="startTask()">{{ $t('tasks.newTask') }}</BaseButton>
      </template>
    </PageHeader>

    <p v-if="loadError" class="mt-6 text-sm text-red-600">{{ loadError }}</p>

    <template v-else-if="view === 'board'">
      <div v-if="auth.isClient && people.freelancersLoaded && !people.freelancers.length" class="mt-6">
        <EmptyState
          :title="$t('tasks.noFreelancersTitle')"
          :description="$t('tasks.noFreelancersBoard')"
        />
      </div>
      <div v-else-if="projects.loaded && !projectId" class="mt-6">
        <EmptyState
          :title="$t('projects.noneYet')"
          :description="auth.isClient ? $t('projects.noneYetClient') : $t('projects.noneYetFreelancer')"
        >
          <RouterLink to="/projects" class="text-sm font-medium text-neutral-900 underline-offset-4 hover:underline">{{ $t('projects.title') }}</RouterLink>
        </EmptyState>
      </div>
      <KanbanBoard v-else-if="projectId" class="mt-5" @new-task="startTask" />
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
      :project-id="projectId || undefined"
      :status-id="newTaskColumn?.id"
      :column-name="newTaskColumn?.name"
      @close="showForm = false"
      @saved="onSaved"
    />

  </DashboardLayout>
</template>
