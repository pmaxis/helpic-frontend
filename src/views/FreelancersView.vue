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
import { t } from '@/i18n'
import type { Task } from '@/types/tasks'

const people = usePeopleStore()
const router = useRouter()
/** The freelancer a new task is being set for. */
const taskFor = ref('')

onMounted(async () => {
  try {
    await people.fetchFreelancers()
  } catch {
    toast.error(t('freelancers.loadFailed'))
  }
})

function onSaved(task: Task) {
  taskFor.value = ''
  void router.push({ name: 'task-detail', params: { id: task.id } })
}
</script>

<template>
  <DashboardLayout>
    <PageHeader :title="$t('freelancers.title')" />

    <div v-if="people.freelancersLoaded && !people.freelancers.length" class="mt-6">
      <EmptyState :title="$t('freelancers.noneYet')" :description="$t('freelancers.noneYetText')" />
    </div>

    <ul v-else-if="people.freelancers.length" class="mt-6 divide-y divide-neutral-100 rounded-xl border border-neutral-200">
      <li v-for="f in people.freelancers" :key="f.id" class="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
        <span class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-xs font-semibold text-neutral-600">
          {{ (f.name || f.email).slice(0, 2).toUpperCase() }}
        </span>
        <div class="min-w-0 flex-1">
          <p class="truncate text-sm font-medium text-neutral-900">{{ f.name || f.email }}</p>
          <p class="truncate text-xs text-neutral-500">{{ $t('people.since', { email: f.email, date: formatDate(f.linked_at) }) }}</p>
        </div>
        <RouterLink
          :to="{ name: 'tasks', query: { with: f.id } }"
          class="shrink-0 text-sm text-neutral-500 underline-offset-4 hover:text-neutral-900 hover:underline"
        >
          {{ $t('people.openTasks', { n: f.open_tasks }, f.open_tasks) }}
        </RouterLink>
        <BaseButton size="sm" :block="false" @click="taskFor = f.id">{{ $t('people.newTask') }}</BaseButton>
      </li>
    </ul>

    <TaskFormModal v-if="taskFor" :people="people.freelancers" :person-id="taskFor" @close="taskFor = ''" @saved="onSaved" />
  </DashboardLayout>
</template>
