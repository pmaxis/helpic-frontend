<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import DashboardLayout from '@/layouts/DashboardLayout.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import ConfirmDialog from '@/components/ui/ConfirmDialog.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import TaskList from '@/components/tasks/TaskList.vue'
import TaskFormModal from '@/components/tasks/TaskFormModal.vue'
import ProjectFormModal from '@/components/projects/ProjectFormModal.vue'
import KanbanBoard from '@/components/board/KanbanBoard.vue'
import ViewToggle from '@/components/ui/ViewToggle.vue'
import ActionMenu from '@/components/ui/ActionMenu.vue'
import { useBoardStore } from '@/stores/board'
import { useTaskView } from '@/composables/useTaskView'
import { useProjectsStore } from '@/stores/projects'
import { useTasksStore } from '@/stores/tasks'
import { ApiRequestError } from '@/services/api'
import { filterLabel as statusFilterLabel, STATUS_FILTERS } from '@/constants/tasks'
import { t } from '@/i18n'
import { toast } from '@/composables/useToasts'
import type { Project } from '@/types/projects'
import type { Task } from '@/types/tasks'
import type { BoardColumn } from '@/types/board'

const projects = useProjectsStore()
const tasks = useTasksStore()
const board = useBoardStore()
const view = useTaskView()
const route = useRoute()
const router = useRouter()
const id = String(route.params.id)

const project = ref<Project | null>(null)
const notFound = ref(false)
const filter = ref('open')
const filterLabel = computed(() => statusFilterLabel(filter.value))
const editing = ref(false)
const addingTask = ref(false)
/** The board column a task is being added from, if any. */
const newTaskColumn = ref<BoardColumn | null>(null)

function startTask(column: BoardColumn | null = null) {
  newTaskColumn.value = column
  addingTask.value = true
}
const confirmDelete = ref(false)
const deleting = ref(false)

const projectActions = computed(() => [
  { label: t('project.edit'), onSelect: () => (editing.value = true) },
  { label: t('project.delete'), danger: true, onSelect: () => (confirmDelete.value = true) },
])

async function loadTasks() {
  try {
    if (view.value === 'board') {
      await board.fetchBoard({ project: id })
    } else {
      const statuses = STATUS_FILTERS.find((f) => f.value === filter.value)?.statuses ?? []
      await tasks.fetchTasks({ statuses, project: id })
    }
  } catch {
    toast.error(t('project.tasksLoadFailed'))
  }
}

watch([filter, view], loadTasks)

onMounted(async () => {
  try {
    project.value = await projects.fetchProject(id)
    if (!projects.loaded) void projects.fetchProjects().catch(() => {})
    await loadTasks()
  } catch (error) {
    if (error instanceof ApiRequestError && error.status === 404) notFound.value = true
    else toast.error(t('project.loadFailed'))
  }
})

function onSaved(p: Project) {
  project.value = p
  editing.value = false
}

async function onTaskSaved(task: Task) {
  addingTask.value = false
  newTaskColumn.value = null
  // On the board the new card shows up in its column; in the list, open the task.
  if (view.value === 'board') await loadTasks()
  else await router.push({ name: 'task-detail', params: { id: task.id } })
}

async function remove() {
  deleting.value = true
  try {
    await projects.deleteProject(id)
    toast.success(t('project.deleted'))
    await router.replace('/projects')
  } catch (error) {
    toast.error(error instanceof ApiRequestError ? error.message : t('project.deleteFailed'))
  } finally {
    deleting.value = false
    confirmDelete.value = false
  }
}
</script>

<template>
  <DashboardLayout :fill="view === 'board'">
    <!-- back, then breadcrumbs -->
    <nav class="flex items-center gap-1.5 self-start text-sm text-neutral-500" :aria-label="$t('project.breadcrumb')">
      <RouterLink
        to="/projects"
        class="-ml-1.5 mr-1 inline-flex h-7 w-7 items-center justify-center rounded-md transition-colors hover:bg-neutral-100 hover:text-neutral-900"
        :aria-label="$t('project.backToProjects')"
        :title="$t('project.backToProjects')"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-4 w-4" aria-hidden="true">
          <path d="M19 12H5" />
          <polyline points="12 19 5 12 12 5" />
        </svg>
      </RouterLink>
      <RouterLink to="/projects" class="hover:text-neutral-900">{{ $t('projects.title') }}</RouterLink>
      <template v-if="project">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-3.5 w-3.5 text-neutral-300" aria-hidden="true">
          <polyline points="9 18 15 12 9 6" />
        </svg>
        <span class="truncate text-neutral-700">{{ project.name }}</span>
      </template>
    </nav>

    <div v-if="notFound" class="mt-6">
      <EmptyState :title="$t('project.notFound')" :description="$t('project.notFoundText')" />
    </div>

    <template v-else-if="project">
      <header class="mt-3 border-b border-neutral-200 pb-5">
        <div class="flex flex-wrap items-center gap-3">
          <span class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-neutral-100 text-neutral-500" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-5 w-5">
              <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
            </svg>
          </span>
          <div class="min-w-0 flex-1">
            <h1 class="text-2xl leading-tight font-semibold tracking-tight break-words text-neutral-900">{{ project.name }}</h1>
          </div>
          <div class="flex shrink-0 items-center gap-2">
            <ViewToggle v-model="view" />
            <ActionMenu v-if="project.can_edit" :actions="projectActions" :label="$t('project.options')" />
            <BaseButton size="sm" :block="false" @click="startTask()">{{ $t('tasks.newTask') }}</BaseButton>
          </div>
        </div>

        <p v-if="project.description" class="mt-4 max-w-3xl text-sm leading-relaxed whitespace-pre-wrap text-neutral-700">{{ project.description }}</p>
      </header>

      <div v-if="view === 'list'" class="mt-5 inline-flex self-start rounded-lg bg-neutral-100 p-0.5 text-sm">
        <button
          v-for="f in STATUS_FILTERS"
          :key="f.value"
          type="button"
          class="rounded-md px-3 py-1 font-medium transition-colors"
          :class="filter === f.value ? 'bg-white text-neutral-900 shadow-xs' : 'text-neutral-500 hover:text-neutral-900'"
          @click="filter = f.value"
        >
          {{ statusFilterLabel(f.value) }}
        </button>
      </div>

      <KanbanBoard v-if="view === 'board'" class="mt-5" hide-project @new-task="startTask" />
      <div v-else-if="!tasks.isLoading && !tasks.tasks.length" class="mt-5">
        <EmptyState
          v-if="filter !== 'all'"
          :title="$t('project.noFiltered', { filter: filterLabel.toLowerCase() })"
          :description="filter === 'open' ? $t('project.allDoneOrCancelled') : $t('tasks.nothingMatches')"
        >
          <div class="flex items-center gap-4">
            <BaseButton size="sm" variant="ghost" :block="false" @click="filter = 'all'">{{ $t('tasks.showAll') }}</BaseButton>
            <BaseButton size="sm" :block="false" @click="startTask()">{{ $t('tasks.newTask') }}</BaseButton>
          </div>
        </EmptyState>
        <EmptyState v-else :title="$t('project.noTasksTitle')" :description="$t('project.noTasksText')">
          <BaseButton size="sm" :block="false" @click="startTask()">{{ $t('tasks.newTask') }}</BaseButton>
        </EmptyState>
      </div>
      <TaskList v-else class="mt-5" :tasks="tasks.tasks" :loading="tasks.isLoading" hide-project @saved="loadTasks" />
    </template>

    <ProjectFormModal v-if="editing && project" :project="project" @close="editing = false" @saved="onSaved" />
    <TaskFormModal v-if="addingTask" :project-id="id" :status-id="newTaskColumn?.id" :column-name="newTaskColumn?.name" @close="addingTask = false" @saved="onTaskSaved" />
    <ConfirmDialog
      v-model:open="confirmDelete"
      :title="$t('project.confirmDelete')"
      :description="$t('project.confirmDeleteText')"
      :loading="deleting"
      @confirm="remove"
    />

  </DashboardLayout>
</template>
