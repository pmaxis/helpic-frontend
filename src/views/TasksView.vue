<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import DashboardLayout from '@/layouts/DashboardLayout.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import BoardIllustration from '@/components/illustrations/BoardIllustration.vue'
import FilterIllustration from '@/components/illustrations/FilterIllustration.vue'
import PeopleIllustration from '@/components/illustrations/PeopleIllustration.vue'
import TaskIllustration from '@/components/illustrations/TaskIllustration.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import MultiSelectInput from '@/components/ui/MultiSelectInput.vue'
import SelectInput from '@/components/ui/SelectInput.vue'
import TaskList from '@/components/tasks/TaskList.vue'
import TaskFormModal from '@/components/tasks/TaskFormModal.vue'
import KanbanBoard from '@/components/board/KanbanBoard.vue'
import TasksHeader, { type TasksTab } from '@/components/tasks/TasksHeader.vue'
import { useBoardStore } from '@/stores/board'
import { useTaskView } from '@/composables/useTaskView'
import { useStatusFilter } from '@/composables/useStatusFilter'
import { useAuthStore } from '@/stores/auth'
import { useTasksStore } from '@/stores/tasks'
import { usePeopleStore } from '@/stores/people'
import { useProjectsStore } from '@/stores/projects'
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
const statuses = useStatusFilter(projectId)
/** The list, like the board, leaves out what waits in the backlog (a page of its own). */
const shown = computed(() => statuses.visible(tasks.tasks.filter((x) => !x.in_backlog)))
/** The list has loaded and has nothing to show. */
const listEmpty = computed(() => view.value === 'list' && !tasks.isLoading && !shown.value.length)

const projectOptions = computed(() => projects.projects.map((p) => ({ value: p.id, label: p.name })))

function pickView(v: TasksTab) {
  view.value = v
}

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
      await Promise.all([tasks.fetchTasks({ project: projectId.value || undefined }), statuses.load().catch(() => {})])
      // The dashboard links here with ?status=done to open that bucket.
      const bucket = route.query.status
      if (bucket === 'new' || bucket === 'in_progress' || bucket === 'done') {
        statuses.selectBucket(bucket)
        void router.replace({ query: { ...route.query, status: undefined, with: undefined } })
      }
    }
  } catch {
    loadError.value = t('tasks.loadFailed')
  }
}

watch([view, projectId], () => void load())
// the backlog button's badge counts the project in view
watch(
  projectId,
  (id) => {
    if (id) void tasks.countBacklog(id)
  },
  { immediate: true },
)

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
  const before = projectId.value
  // The backlog links back here for the project it showed.
  if (typeof route.query.project === 'string') projectId.value = route.query.project
  if (route.query.with || route.query.project) {
    void router.replace({ query: { ...route.query, with: undefined, project: undefined } })
  }
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
  <!-- the board fills the page, and so does an empty list, so its empty state sits in the middle -->
  <DashboardLayout :fill="view === 'board' || listEmpty">
    <TasksHeader
      :backlog-count="tasks.backlogCount"
      :active="view"
      :backlog-to="{ name: 'backlog', query: { project: projectId || undefined } }"
      @update:active="pickView"
      @new-task="startTask()"
    >
      <template v-if="projectOptions.length || view === 'list'" #filters>
        <!-- the project, then in the list its statuses: quiet filters like the tabs beside them -->
        <SelectInput
          v-if="projectOptions.length"
          v-model="projectId"
          :options="projectOptions"
          :aria-label="$t('tasks.projects')"
          size="sm"
          variant="plain"
          class="max-w-56 min-w-0 text-neutral-500"
          data-project-picker
        />
        <MultiSelectInput
          v-if="view === 'list'"
          v-model="statuses.selected"
          :label="$t('tasks.statusAria')"
          :placeholder="$t('tasks.allStatuses')"
          :options="statuses.options"
          hide-label
          size="sm"
          variant="plain"
          class="text-neutral-500"
        />
      </template>
    </TasksHeader>

    <p v-if="loadError" class="mt-6 text-sm text-red-600">{{ loadError }}</p>

    <template v-else-if="view === 'board'">
      <div v-if="auth.isClient && people.freelancersLoaded && !people.freelancers.length" class="mt-6 flex min-h-0 flex-1 flex-col">
        <EmptyState
          class="flex-1 justify-center"
          :title="$t('tasks.noFreelancersTitle')"
          :description="$t('tasks.noFreelancersBoard')"
        >
          <template #illustration>
            <PeopleIllustration />
          </template>
          <RouterLink v-if="auth.isTeamOwner" to="/freelancers" class="text-sm font-medium text-neutral-900 underline-offset-4 hover:underline">{{ $t('freelancers.invite') }}</RouterLink>
        </EmptyState>
      </div>
      <div v-else-if="projects.loaded && !projectId" class="mt-6 flex min-h-0 flex-1 flex-col">
        <EmptyState
          class="flex-1 justify-center"
          :title="$t('projects.noneYet')"
          :description="auth.isClient ? $t('projects.noneYetClient') : $t('projects.noneYetFreelancer')"
        >
          <template #illustration>
            <BoardIllustration />
          </template>
          <RouterLink to="/projects" class="text-sm font-medium text-neutral-900 underline-offset-4 hover:underline">{{ $t('projects.title') }}</RouterLink>
        </EmptyState>
      </div>
      <KanbanBoard v-else-if="projectId" class="mt-5" @new-task="startTask" />
    </template>

    <div v-else-if="listEmpty" class="mt-6 flex min-h-0 flex-1 flex-col">
      <EmptyState
        v-if="auth.isClient && people.freelancersLoaded && !people.freelancers.length"
        class="flex-1 justify-center"
        :title="$t('tasks.noFreelancersTitle')"
        :description="$t('tasks.noFreelancersTasks')"
      >
        <template #illustration>
          <PeopleIllustration />
        </template>
        <BaseButton size="sm" :block="false" @click="startTask()">{{ $t('tasks.newTask') }}</BaseButton>
      </EmptyState>
      <EmptyState
        v-else-if="statuses.selected.length"
        class="flex-1 justify-center"
        :title="$t('tasks.noStatusMatch')"
        :description="$t('tasks.nothingMatches')"
      >
        <template #illustration>
          <FilterIllustration />
        </template>
        <div class="flex items-center gap-4">
          <BaseButton size="sm" variant="ghost" :block="false" @click="statuses.selected = []">{{ $t('tasks.showAll') }}</BaseButton>
          <BaseButton size="sm" :block="false" @click="startTask()">{{ $t('tasks.newTask') }}</BaseButton>
        </div>
      </EmptyState>
      <EmptyState v-else-if="auth.isClient" class="flex-1 justify-center" :title="$t('tasks.emptyTitle')" :description="$t('tasks.emptyClient')">
        <template #illustration>
          <TaskIllustration />
        </template>
        <BaseButton size="sm" :block="false" @click="startTask()">{{ $t('tasks.newTask') }}</BaseButton>
      </EmptyState>
      <EmptyState
        v-else-if="!people.clients.length"
        class="flex-1 justify-center"
        :title="$t('tasks.noneYetTitle')"
        :description="$t('tasks.noneYetPersonal')"
      >
        <template #illustration>
          <TaskIllustration />
        </template>
        <div class="flex items-center gap-4">
          <BaseButton size="sm" :block="false" @click="startTask()">{{ $t('tasks.newTask') }}</BaseButton>
          <RouterLink to="/clients" class="text-sm font-medium text-neutral-900 underline-offset-4 hover:underline">{{ $t('tasks.inviteClient') }}</RouterLink>
        </div>
      </EmptyState>
      <EmptyState v-else class="flex-1 justify-center" :title="$t('tasks.emptyTitle')" :description="$t('tasks.noneYetFreelancer')">
        <template #illustration>
          <TaskIllustration />
        </template>
        <BaseButton size="sm" :block="false" @click="startTask()">{{ $t('tasks.newTask') }}</BaseButton>
      </EmptyState>
    </div>

    <TaskList v-else class="mt-5" :tasks="shown" :loading="tasks.isLoading" />

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
