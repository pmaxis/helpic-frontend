<script setup lang="ts">
/**
 * Tasks closed for good: shared work whose report was paid, and personal
 * tasks put away by hand. They're off every board; here they're listed, the
 * most recently archived first, a page at a time. Each opens read-only.
 */
import { computed, onMounted, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'
import DashboardLayout from '@/layouts/DashboardLayout.vue'
import PageHeader from '@/components/ui/PageHeader.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import SelectInput from '@/components/ui/SelectInput.vue'
import StatusBadge from '@/components/tasks/StatusBadge.vue'
import ArchiveIllustration from '@/components/illustrations/ArchiveIllustration.vue'
import FilterIllustration from '@/components/illustrations/FilterIllustration.vue'
import { fetchArchive } from '@/services/archive'
import { useAuthStore } from '@/stores/auth'
import { usePeopleStore } from '@/stores/people'
import { useProjectsStore } from '@/stores/projects'
import { formatDate } from '@/utils/format'
import { t } from '@/i18n'
import type { Task } from '@/types/tasks'

const auth = useAuthStore()
const people = usePeopleStore()
const projects = useProjectsStore()

const list = ref<Task[]>([])
const next = ref<string | undefined>()
const loading = ref(false)
const loaded = ref(false)
const loadError = ref('')

/** Whose tasks: everyone's (''), the user's own ('personal'), or one counterpart's. */
const withId = ref('')
const projectId = ref('')

const counterparts = computed(() => (auth.isClient ? people.freelancers : people.clients))
const withOptions = computed(() => [
  { value: '', label: t('archive.all') },
  { value: 'personal', label: t('archive.personal') },
  ...counterparts.value.map((p) => ({ value: p.id, label: p.name || p.email })),
])
const projectOptions = computed(() => [
  { value: '', label: t('archive.allProjects') },
  ...projects.projects.map((p) => ({ value: p.id, label: p.name })),
])

/** Reads the first page, or the next one after what's shown. */
async function load(more = false) {
  loading.value = true
  loadError.value = ''
  try {
    const page = await fetchArchive({ with: withId.value, project: projectId.value, before: more ? next.value : undefined })
    list.value = more ? [...list.value, ...page.tasks] : page.tasks
    next.value = page.next
    loaded.value = true
  } catch {
    loadError.value = t('archive.loadFailed')
  } finally {
    loading.value = false
  }
}

watch([withId, projectId], () => void load())

function clearFilters() {
  withId.value = ''
  projectId.value = ''
}

onMounted(() => {
  void load()
  void (auth.isClient ? people.fetchFreelancers() : people.fetchClients()).catch(() => {})
  if (!projects.loaded) void projects.fetchProjects().catch(() => {})
})

/** Where the task belonged: its project, the other side, or the user's own work. */
function where(task: Task): string {
  if (task.project) return task.project.name
  if (!task.client) return t('archive.personal')
  const other = auth.isClient ? task.freelancer : task.client
  return other ? other.name || other.email : ''
}
</script>

<template>
  <!-- an empty archive fills the page, so its empty state sits in the middle -->
  <DashboardLayout :fill="loaded && !list.length">
    <PageHeader :title="$t('archive.title')">
      <template #actions>
        <SelectInput v-model="withId" :options="withOptions" :aria-label="$t('archive.whose')" size="sm" class="w-48" />
        <SelectInput v-if="projects.projects.length" v-model="projectId" :options="projectOptions" :aria-label="$t('archive.project')" size="sm" class="w-48" />
      </template>
    </PageHeader>

    <p v-if="loadError" class="mt-6 text-sm text-red-600">{{ loadError }}</p>

    <div v-else-if="loaded && !list.length" class="mt-6 flex min-h-0 flex-1 flex-col">
      <EmptyState v-if="withId || projectId" class="flex-1 justify-center" :title="$t('archive.nothingMatches')">
        <template #illustration>
          <FilterIllustration />
        </template>
        <BaseButton size="sm" variant="ghost" :block="false" @click="clearFilters">{{ $t('archive.showAll') }}</BaseButton>
      </EmptyState>
      <EmptyState v-else class="flex-1 justify-center" :title="$t('archive.empty')" :description="$t('archive.emptyText')">
        <template #illustration>
          <ArchiveIllustration />
        </template>
        <RouterLink to="/tasks" class="text-sm font-medium text-neutral-900 underline-offset-4 hover:underline">{{ $t('archive.toTasks') }}</RouterLink>
      </EmptyState>
    </div>

    <template v-else-if="list.length">
      <ul class="mt-5 divide-y divide-neutral-100 overflow-hidden rounded-xl border border-neutral-200" :class="loading ? 'opacity-60' : ''">
        <li v-for="task in list" :key="task.id">
          <RouterLink
            :to="{ name: 'task-detail', params: { id: task.id } }"
            class="grid gap-x-4 gap-y-1.5 px-4 py-3 transition-colors hover:bg-neutral-50 md:grid-cols-[minmax(0,1fr)_9rem_minmax(0,12rem)_8rem] md:items-center"
          >
            <div class="min-w-0">
              <p class="truncate text-sm font-medium text-neutral-900">{{ task.title }}</p>
              <p class="mt-0.5 truncate text-xs text-neutral-500">{{ where(task) }}</p>
            </div>
            <div class="min-w-0">
              <StatusBadge :status="task.status" :name="task.status_name" />
            </div>
            <p class="min-w-0 truncate text-sm text-neutral-600">
              <template v-if="task.archived_by">{{ $t('archive.paidIn', { report: task.archived_by.title }) }}</template>
              <span v-else class="text-neutral-400">{{ $t('archive.byHand') }}</span>
            </p>
            <p class="text-sm whitespace-nowrap text-neutral-500 md:text-right">
              <time v-if="task.archived_at" :datetime="task.archived_at">{{ formatDate(task.archived_at) }}</time>
            </p>
          </RouterLink>
        </li>
      </ul>
      <div v-if="next" class="mt-4 flex justify-center">
        <BaseButton variant="ghost" size="sm" :block="false" :loading="loading" @click="load(true)">{{ $t('archive.more') }}</BaseButton>
      </div>
    </template>
  </DashboardLayout>
</template>
