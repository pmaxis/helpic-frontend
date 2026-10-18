<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import DashboardLayout from '@/layouts/DashboardLayout.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import TaskList from '@/components/tasks/TaskList.vue'
import TaskFormModal from '@/components/tasks/TaskFormModal.vue'
import KanbanBoard from '@/components/board/KanbanBoard.vue'
import ViewToggle from '@/components/ui/ViewToggle.vue'
import MultiSelectInput from '@/components/ui/MultiSelectInput.vue'
import AvatarStack from '@/components/tasks/AvatarStack.vue'
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
const view = useTaskView()
const route = useRoute()
const router = useRouter()
const id = String(route.params.id)

const project = ref<Project | null>(null)
const participants = ref<ProjectPerson[]>([])
const notFound = ref(false)
const projectId = ref(id)
const statuses = useStatusFilter(projectId)
const shown = computed(() => statuses.visible(tasks.tasks))
const addingTask = ref(false)
/** The board column a task is being added from, if any. */
const newTaskColumn = ref<BoardColumn | null>(null)

function startTask(column: BoardColumn | null = null) {
  newTaskColumn.value = column
  addingTask.value = true
}

async function loadTasks() {
  try {
    if (view.value === 'board') {
      await board.fetchBoard({ project: id })
    } else {
      await Promise.all([tasks.fetchTasks({ project: id }), statuses.load().catch(() => {})])
    }
  } catch {
    toast.error(t('project.tasksLoadFailed'))
  }
}

watch(view, loadTasks)

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

async function onTaskSaved(task: Task) {
  addingTask.value = false
  newTaskColumn.value = null
  // On the board the new card shows up in its column; in the list, open the task.
  if (view.value === 'board') await loadTasks()
  else await router.push({ name: 'task-detail', params: { id: task.id } })
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
            <MultiSelectInput
              v-if="view === 'list'"
              v-model="statuses.selected"
              :label="$t('tasks.statusAria')"
              :placeholder="$t('tasks.allStatuses')"
              :options="statuses.options"
              hide-label
              size="sm"
              class="w-48 shrink-0"
            />
            <AvatarStack v-if="participants.length" :people="participants" size="md" />
            <RouterLink
              v-if="project.can_edit"
              :to="{ name: 'project-settings', params: { id: project.id } }"
              class="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-neutral-200 bg-white text-neutral-500 shadow-xs transition-colors hover:bg-neutral-50 hover:text-neutral-900"
              :aria-label="$t('project.settings')"
              :title="$t('project.settings')"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-4 w-4" aria-hidden="true">
                <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            </RouterLink>
            <BaseButton size="sm" :block="false" @click="startTask()">{{ $t('tasks.newTask') }}</BaseButton>
          </div>
        </div>

        <p v-if="project.description" class="mt-4 max-w-3xl text-sm leading-relaxed whitespace-pre-wrap text-neutral-700">{{ project.description }}</p>
      </header>

      <KanbanBoard v-if="view === 'board'" class="mt-5" hide-project @new-task="startTask" />
      <div v-else-if="!tasks.isLoading && !shown.length" class="mt-5">
        <EmptyState
          v-if="statuses.selected.length"
          :title="$t('tasks.noStatusMatch')"
          :description="$t('tasks.nothingMatches')"
        >
          <div class="flex items-center gap-4">
            <BaseButton size="sm" variant="ghost" :block="false" @click="statuses.selected = []">{{ $t('tasks.showAll') }}</BaseButton>
            <BaseButton size="sm" :block="false" @click="startTask()">{{ $t('tasks.newTask') }}</BaseButton>
          </div>
        </EmptyState>
        <EmptyState v-else :title="$t('project.noTasksTitle')" :description="$t('project.noTasksText')">
          <BaseButton size="sm" :block="false" @click="startTask()">{{ $t('tasks.newTask') }}</BaseButton>
        </EmptyState>
      </div>
      <TaskList v-else class="mt-5" :tasks="shown" :loading="tasks.isLoading" hide-project @saved="loadTasks" />
    </template>

    <TaskFormModal v-if="addingTask" :project-id="id" :status-id="newTaskColumn?.id" :column-name="newTaskColumn?.name" @close="addingTask = false" @saved="onTaskSaved" />

  </DashboardLayout>
</template>
