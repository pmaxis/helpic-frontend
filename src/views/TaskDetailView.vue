<script setup lang="ts">
import { ref } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import DashboardLayout from '@/layouts/DashboardLayout.vue'
import TaskDetails from '@/components/tasks/TaskDetails.vue'
import type { Task } from '@/types/tasks'

const route = useRoute()
const router = useRouter()

const task = ref<Task | null>(null)

/**
 * Back to wherever the task was opened from (the board or list, with its
 * filters; a project). Opened from a link with nothing to go back to, it goes
 * to the task's project, or the task list.
 */
function goBack() {
  if (window.history.state?.back) {
    router.back()
    return
  }
  const project = task.value?.project
  void router.push(project ? { name: 'project-detail', params: { id: project.id } } : { name: 'tasks' })
}
</script>

<template>
  <DashboardLayout bare>
    <TaskDetails
      :task-id="String(route.params.id)"
      @loaded="task = $event"
      @changed="task = $event"
      @deleted="router.replace('/tasks')"
    >
      <template #nav>
        <!-- back, then breadcrumbs -->
        <nav class="flex items-center gap-1.5 text-sm text-neutral-500" aria-label="Breadcrumb">
          <button
            type="button"
            class="-ml-1.5 mr-1 inline-flex h-7 w-7 items-center justify-center rounded-md text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-900"
            aria-label="Back"
            title="Back"
            @click="goBack"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-4 w-4" aria-hidden="true">
              <path d="M19 12H5" />
              <polyline points="12 19 5 12 12 5" />
            </svg>
          </button>
          <RouterLink to="/tasks" class="hover:text-neutral-900">Tasks</RouterLink>
          <template v-if="task?.project">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-3.5 w-3.5 text-neutral-300" aria-hidden="true">
              <polyline points="9 18 15 12 9 6" />
            </svg>
            <RouterLink :to="{ name: 'project-detail', params: { id: task.project.id } }" class="truncate hover:text-neutral-900">
              {{ task.project.name }}
            </RouterLink>
          </template>
        </nav>
      </template>
    </TaskDetails>
  </DashboardLayout>
</template>
