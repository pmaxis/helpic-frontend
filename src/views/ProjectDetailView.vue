<script setup lang="ts">
/**
 * A project: its head (name, people, rate, settings), and its tasks as a list
 * or a board. The project's backlog is here too, at /projects/:id/backlog,
 * with a head like the project's settings ("← Projects › Landing › Backlog")
 * and the tasks put off for later in place of the list. A new task made there waits in the backlog.
 */
import { computed, onMounted, ref, watch } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import DashboardLayout from '@/layouts/DashboardLayout.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import FilterIllustration from '@/components/illustrations/FilterIllustration.vue'
import NotFoundIllustration from '@/components/illustrations/NotFoundIllustration.vue'
import TaskIllustration from '@/components/illustrations/TaskIllustration.vue'
import TaskList from '@/components/tasks/TaskList.vue'
import TaskFormModal from '@/components/tasks/TaskFormModal.vue'
import KanbanBoard from '@/components/board/KanbanBoard.vue'
import TasksHeader from '@/components/tasks/TasksHeader.vue'
import BacklogHead from '@/components/tasks/BacklogHead.vue'
import PageCrumbs from '@/components/ui/PageCrumbs.vue'
import MultiSelectInput from '@/components/ui/MultiSelectInput.vue'
import AvatarStack from '@/components/tasks/AvatarStack.vue'
import ProjectRate from '@/components/projects/ProjectRate.vue'
import { fetchProjectPeople } from '@/services/projectPeople'
import { useBoardStore } from '@/stores/board'
import { useTaskView } from '@/composables/useTaskView'
import { useStatusFilter } from '@/composables/useStatusFilter'
import { useProjectsStore } from '@/stores/projects'
import { useTasksStore } from '@/stores/tasks'
import { ApiRequestError } from '@/services/api'
import { t } from '@/i18n'
import { toast } from '@/composables/useToasts'
import type { Project, ProjectPerson } from '@/types/projects'
import type { Task } from '@/types/tasks'
import type { BoardColumn } from '@/types/board'

const projects = useProjectsStore()
const tasks = useTasksStore()
const board = useBoardStore()
/** A project opens on its board; ?view=list asks for the list. */
const view = useTaskView(false)
const route = useRoute()
const router = useRouter()
const id = String(route.params.id)

const project = ref<Project | null>(null)
const participants = ref<ProjectPerson[]>([])
const notFound = ref(false)
const projectId = ref(id)
const statuses = useStatusFilter(projectId)
/** This is the project's backlog rather than its tasks. */
const inBacklog = computed(() => route.name === 'project-backlog')
/** What's still waiting in the backlog: a task put back on the board leaves the list at once. */
/** The backlog's tasks there, and only there: the list, like the board, leaves them out. */
const shown = computed(() => (inBacklog.value ? tasks.tasks.filter((x) => x.in_backlog) : statuses.visible(tasks.tasks.filter((x) => !x.in_backlog))))
/** The task list (or the backlog) has loaded and has nothing to show. */
const listEmpty = computed(() => (inBacklog.value || view.value === 'list') && !!project.value && !tasks.isLoading && !shown.value.length)

function pickView(v: 'list' | 'board') {
  view.value = v
}
const addingTask = ref(false)
/** The board column a task is being added from, if any. */
const newTaskColumn = ref<BoardColumn | null>(null)

function startTask(column: BoardColumn | null = null) {
  newTaskColumn.value = column
  addingTask.value = true
}

async function loadTasks() {
  try {
    if (inBacklog.value) {
      await tasks.fetchTasks({ project: id, backlog: true })
    } else if (view.value === 'board') {
      await board.fetchBoard({ project: id })
    } else {
      await Promise.all([tasks.fetchTasks({ project: id }), statuses.load().catch(() => {})])
    }
  } catch {
    toast.error(t('project.tasksLoadFailed'))
  }
}

watch([view, inBacklog], () => void loadTasks())
// the backlog button's badge: how many of this project's tasks wait there
void tasks.countBacklog(id)

onMounted(async () => {
  try {
    project.value = await projects.fetchProject(id)
    if (!projects.loaded) void projects.fetchProjects().catch(() => {})
    void fetchProjectPeople(id)
      .then((people) => {
        participants.value = people.participants
      })
      .catch(() => {
        participants.value = []
      })
    await loadTasks()
  } catch (error) {
    if (error instanceof ApiRequestError && error.status === 404) notFound.value = true
    else toast.error(t('project.loadFailed'))
  }
})

/** The viewer's rate here changed: so did the prices of their hourly tasks. */
function onRateChanged(p: Project) {
  project.value = p
  void loadTasks()
}

async function onTaskSaved(task: Task) {
  addingTask.value = false
  newTaskColumn.value = null
  // In the backlog and on the board the new task shows up in place; in the list, open it.
  // a task made in the backlog adds to its button's badge
  if (inBacklog.value) void tasks.countBacklog(id)
  if (inBacklog.value || view.value === 'board') await loadTasks()
  else await router.push({ name: 'task-detail', params: { id: task.id } })
}
</script>

<template>
  <!-- the board fills the page, and so does an empty state, so it sits in the middle -->
  <DashboardLayout :fill="(view === 'board' && !inBacklog) || notFound || listEmpty">
    <!-- a project that isn't there: just the way back -->
    <RouterLink v-if="notFound" to="/projects" class="inline-flex items-center gap-1.5 self-start text-sm text-neutral-500 hover:text-neutral-900">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-4 w-4" aria-hidden="true">
        <path d="M19 12H5" />
        <polyline points="12 19 5 12 12 5" />
      </svg>
      {{ $t('project.backToProjects') }}
    </RouterLink>

    <div v-if="notFound" class="mt-6 flex min-h-0 flex-1 flex-col">
      <EmptyState class="flex-1 justify-center" :title="$t('project.notFound')" :description="$t('project.notFoundText')">
        <template #illustration>
          <NotFoundIllustration />
        </template>
      </EmptyState>
    </div>

    <template v-else-if="project">
      <!-- the backlog's head reads like the project's settings: crumbs with a way back, then its title -->
      <BacklogHead
        v-if="inBacklog"
        :crumbs="[
          { label: $t('projects.title'), to: '/projects' },
          { label: project.name, to: { name: 'project-detail', params: { id: project.id } } },
        ]"
        :back-to="{ name: 'project-detail', params: { id: project.id } }"
        :back-label="$t('backlog.closeProject')"
        :description="project.name"
      >
        <template #actions>
          <BaseButton size="sm" :block="false" @click="startTask()">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" class="h-3.5 w-3.5" aria-hidden="true">
              <path d="M12 5v14M5 12h14" />
            </svg>
            {{ $t('tasks.newTask') }}
          </BaseButton>
        </template>
      </BacklogHead>
      <template v-else>
        <!-- crumbs with a way back, as on the project's settings; then the tasks page's head, the project's name for its title -->
        <PageCrumbs
          :crumbs="[{ label: $t('projects.title'), to: '/projects' }]"
          :current="project.name"
          back-to="/projects"
          :back-label="$t('project.backToProjects')"
          :label="$t('project.breadcrumb')"
          class="mb-3"
        />
        <TasksHeader
          :backlog-count="tasks.backlogCount"
          :active="view"
          :backlog-to="{ name: 'project-backlog', params: { id: project.id } }"
          :backlog-label="$t('backlog.openFor', { project: project.name })"
          @update:active="pickView"
          @new-task="startTask()"
        >
          <template #title>
            <h1 class="min-w-0 truncate text-neutral-900" :title="project.name">{{ project.name }}</h1>
          </template>
          <template #actions>
            <AvatarStack v-if="participants.length" :people="participants" size="md" />
            <ProjectRate v-if="project.can_set_rate" :project="project" @changed="onRateChanged" />
            <RouterLink
              v-if="project.can_edit"
              :to="{ name: 'project-settings', params: { id: project.id } }"
              class="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-neutral-300 bg-white text-neutral-500 shadow-xs transition-colors hover:bg-neutral-50 hover:text-neutral-900"
              :aria-label="$t('project.settings')"
              :title="$t('project.settings')"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-4 w-4" aria-hidden="true">
                <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            </RouterLink>
          </template>
          <template v-if="project.description" #description>
            <p class="mt-2 max-w-3xl text-sm leading-relaxed whitespace-pre-wrap text-neutral-500">{{ project.description }}</p>
          </template>
          <template v-if="view === 'list'" #filters>
            <MultiSelectInput
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
      </template>

      <KanbanBoard v-if="view === 'board' && !inBacklog" class="mt-5" hide-project @new-task="startTask" />
      <div v-else-if="listEmpty" class="mt-5 flex min-h-0 flex-1 flex-col">
        <EmptyState v-if="inBacklog" class="flex-1 justify-center" :title="$t('backlog.emptyProject')" :description="$t('backlog.emptyText')">
          <template #illustration>
            <TaskIllustration />
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
        <EmptyState v-else class="flex-1 justify-center" :title="$t('project.noTasksTitle')" :description="$t('project.noTasksText')">
          <template #illustration>
            <TaskIllustration />
          </template>
          <BaseButton size="sm" :block="false" @click="startTask()">{{ $t('tasks.newTask') }}</BaseButton>
        </EmptyState>
      </div>
      <TaskList v-else class="mt-5" :tasks="shown" :loading="tasks.isLoading" hide-project @saved="loadTasks" />
    </template>

    <TaskFormModal
      v-if="addingTask"
      :project-id="id"
      :status-id="newTaskColumn?.id"
      :column-name="newTaskColumn?.name"
      :backlog="inBacklog"
      @close="addingTask = false"
      @saved="onTaskSaved"
    />

  </DashboardLayout>
</template>
