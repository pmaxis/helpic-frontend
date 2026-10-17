<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import DashboardLayout from '@/layouts/DashboardLayout.vue'
import PageHeader from '@/components/ui/PageHeader.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import TaskFormModal from '@/components/tasks/TaskFormModal.vue'
import { usePeopleStore } from '@/stores/people'
import { formatDate } from '@/utils/format'
import { toast } from '@/composables/useToasts'
import type { Task } from '@/types/tasks'

const people = usePeopleStore()
const router = useRouter()
/** The freelancer a new task is being set for. */
const taskFor = ref('')

onMounted(async () => {
  try {
    await people.fetchFreelancers()
  } catch {
    toast.error('Could not load freelancers')
  }
})

function onSaved(task: Task) {
  taskFor.value = ''
  void router.push({ name: 'task-detail', params: { id: task.id } })
}
</script>

<template>
  <DashboardLayout>
    <PageHeader title="Freelancers" />

    <div v-if="people.freelancersLoaded && !people.freelancers.length" class="mt-6">
      <EmptyState title="No freelancers yet" description="A freelancer adds you by sending an invitation link." />
    </div>

    <ul v-else-if="people.freelancers.length" class="mt-6 divide-y divide-neutral-100 rounded-xl border border-neutral-200">
      <li v-for="f in people.freelancers" :key="f.id" class="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
        <span class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-xs font-semibold text-neutral-600">
          {{ (f.name || f.email).slice(0, 2).toUpperCase() }}
        </span>
        <div class="min-w-0 flex-1">
          <p class="truncate text-sm font-medium text-neutral-900">{{ f.name || f.email }}</p>
          <p class="truncate text-xs text-neutral-500">{{ f.email }} · since {{ formatDate(f.linked_at) }}</p>
        </div>
        <RouterLink
          :to="{ name: 'tasks', query: { with: f.id } }"
          class="shrink-0 text-sm text-neutral-500 underline-offset-4 hover:text-neutral-900 hover:underline"
        >
          {{ f.open_tasks }} open {{ f.open_tasks === 1 ? 'task' : 'tasks' }}
        </RouterLink>
        <BaseButton size="sm" :block="false" @click="taskFor = f.id">New task</BaseButton>
      </li>
    </ul>

    <TaskFormModal v-if="taskFor" :people="people.freelancers" :person-id="taskFor" @close="taskFor = ''" @saved="onSaved" />
  </DashboardLayout>
</template>
