<script setup lang="ts">
/**
 * The backlog: tasks put off for later. They keep their status, but stay off
 * the boards until someone puts them back, from a row's ⋯ menu here or from
 * the task's own page. The most urgent come first.
 * The head reads like a report's: "← Tasks › Backlog", then the title.
 * The project filter is in the address (?project=), so the tasks page and a
 * project's page link straight to that project's backlog. A new task made
 * here waits in it.
 */
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import DashboardLayout from '@/layouts/DashboardLayout.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import BacklogHead from '@/components/tasks/BacklogHead.vue'
import SelectInput from '@/components/ui/SelectInput.vue'
import TaskList from '@/components/tasks/TaskList.vue'
import TaskFormModal from '@/components/tasks/TaskFormModal.vue'
import TaskIllustration from '@/components/illustrations/TaskIllustration.vue'
import FilterIllustration from '@/components/illustrations/FilterIllustration.vue'
import { useAuthStore } from '@/stores/auth'
import { usePeopleStore } from '@/stores/people'
import { useProjectsStore } from '@/stores/projects'
import { useTasksStore } from '@/stores/tasks'
import { t } from '@/i18n'

const auth = useAuthStore()
const people = usePeopleStore()
const projects = useProjectsStore()
const tasks = useTasksStore()
const route = useRoute()
const router = useRouter()

/** The project in the address; '' is every project's backlog, and the tasks outside any. */
const projectId = computed({
  get: () => (typeof route.query.project === 'string' ? route.query.project : ''),
  set: (id: string) => void router.replace({ query: { ...route.query, project: id || undefined } }),
})

const projectOptions = computed(() =>
  projects.projects.length ? [{ value: '', label: t('backlog.allProjects') }, ...projects.projects.map((p) => ({ value: p.id, label: p.name }))] : [],
)

/** Back to the tasks, for the project in view. */
const tasksLink = computed(() => ({ name: 'tasks', query: { project: projectId.value || undefined } }))

/** The people on the other side, for a new task outside a project. */
const counterparts = computed(() => (auth.isClient ? people.freelancers : people.clients))

/** What's still waiting: a task put back on the board leaves the list at once. */
const shown = computed(() => tasks.tasks.filter((x) => x.in_backlog))

const loaded = ref(false)
const loadError = ref('')

async function load() {
  loadError.value = ''
  try {
    await tasks.fetchTasks({ project: projectId.value || undefined, backlog: true })
    loaded.value = true
  } catch {
    loadError.value = t('backlog.loadFailed')
  }
}

watch(projectId, () => {
  // leaving the page drops the query too: nothing to load then
  if (route.name === 'backlog') void load()
})

onMounted(() => {
  void load()
  if (!projects.loaded) void projects.fetchProjects().catch(() => {})
  void (auth.isClient ? people.fetchFreelancers() : people.fetchClients()).catch(() => {})
})

const adding = ref(false)

function onSaved() {
  adding.value = false
  void load()
}
</script>

<template>
  <!-- an empty backlog fills the page, so its empty state sits in the middle -->
  <DashboardLayout :fill="loaded && !shown.length">
    <BacklogHead
      :crumbs="[{ label: $t('tasks.title'), to: tasksLink }]"
      :back-to="tasksLink"
      :back-label="$t('backlog.close')"
    >
      <template #actions>
        <SelectInput
          v-if="projectOptions.length"
          v-model="projectId"
          :options="projectOptions"
          :aria-label="$t('tasks.projects')"
          size="sm"
          class="w-56"
        />
        <BaseButton size="sm" :block="false" @click="adding = true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" class="h-3.5 w-3.5" aria-hidden="true">
            <path d="M12 5v14M5 12h14" />
          </svg>
          {{ $t('tasks.newTask') }}
        </BaseButton>
      </template>
    </BacklogHead>

    <p v-if="loadError" class="mt-6 text-sm text-red-600">{{ loadError }}</p>

    <div v-else-if="loaded && !shown.length" class="mt-6 flex min-h-0 flex-1 flex-col">
      <EmptyState v-if="projectId" class="flex-1 justify-center" :title="$t('backlog.nothingMatches')">
        <template #illustration>
          <FilterIllustration />
        </template>
        <div class="flex items-center gap-4">
          <BaseButton size="sm" variant="ghost" :block="false" @click="projectId = ''">{{ $t('backlog.showAll') }}</BaseButton>
          <BaseButton size="sm" :block="false" @click="adding = true">{{ $t('tasks.newTask') }}</BaseButton>
        </div>
      </EmptyState>
      <EmptyState v-else class="flex-1 justify-center" :title="$t('backlog.empty')" :description="$t('backlog.emptyText')">
        <template #illustration>
          <TaskIllustration />
        </template>
        <BaseButton size="sm" :block="false" @click="adding = true">{{ $t('tasks.newTask') }}</BaseButton>
      </EmptyState>
    </div>

    <TaskList v-else class="mt-5" :tasks="shown" :loading="tasks.isLoading" :hide-project="!!projectId" @saved="load" />

    <TaskFormModal
      v-if="adding"
      :people="counterparts"
      :project-id="projectId || undefined"
      backlog
      @close="adding = false"
      @saved="onSaved"
    />
  </DashboardLayout>
</template>
