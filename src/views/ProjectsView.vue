<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import DashboardLayout from '@/layouts/DashboardLayout.vue'
import PageHeader from '@/components/ui/PageHeader.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import ProjectIllustration from '@/components/illustrations/ProjectIllustration.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import ViewToggle, { type ViewOption } from '@/components/ui/ViewToggle.vue'
import AvatarStack from '@/components/tasks/AvatarStack.vue'
import ProjectFormModal from '@/components/projects/ProjectFormModal.vue'
import { useAuthStore } from '@/stores/auth'
import { useProjectsStore } from '@/stores/projects'
import { usePeopleStore } from '@/stores/people'
import { useViewMode } from '@/composables/useViewMode'
import { formatDate } from '@/utils/format'
import { toast } from '@/composables/useToasts'
import { t } from '@/i18n'
import type { Project } from '@/types/projects'

const auth = useAuthStore()
const projects = useProjectsStore()
const people = usePeopleStore()
const router = useRouter()
const creating = ref(false)
const query = ref('')

const VIEWS: ViewOption<'cards' | 'list'>[] = [
  { value: 'cards', icon: 'cards' },
  { value: 'list', icon: 'list' },
]
const view = useViewMode('helpic:projects-view', ['cards', 'list'] as const, 'cards')

const counterparts = computed(() => (auth.isClient ? people.freelancers : people.clients))

/** Projects matching the search, by name or description. */
const shown = computed(() => {
  const q = query.value.trim().toLowerCase()
  if (!q) return projects.projects
  return projects.projects.filter((p) => p.name.toLowerCase().includes(q) || p.description.toLowerCase().includes(q))
})

onMounted(async () => {
  try {
    await Promise.all([projects.fetchProjects(), auth.isClient ? people.fetchFreelancers() : people.fetchClients()])
  } catch {
    toast.error(t('projects.loadFailed'))
  }
})

function onSaved(project: Project) {
  creating.value = false
  void router.push({ name: 'project-detail', params: { id: project.id } })
}
</script>

<template>
  <!-- with no projects the page is filled, so the empty state sits in the middle -->
  <DashboardLayout :fill="projects.loaded && !projects.projects.length">
    <PageHeader :title="$t('projects.title')">
      <template #actions>
        <!-- search -->
        <div v-if="projects.projects.length" class="relative w-56">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            class="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-neutral-400"
            aria-hidden="true"
          >
            <circle cx="11" cy="11" r="7" />
            <path d="m21 21-4.3-4.3" />
          </svg>
          <input
            v-model="query"
            type="search"
            :placeholder="$t('projects.search')"
            :aria-label="$t('projects.search')"
            class="h-8 w-full rounded-lg border border-neutral-200 bg-white pr-3 pl-9 text-sm text-neutral-900 shadow-xs placeholder:text-neutral-400 focus:border-neutral-900 focus:ring-2 focus:ring-neutral-900/10 focus:outline-none"
          />
        </div>
        <ViewToggle v-model="view" :options="VIEWS" />
        <!-- a contractor works in the company's projects but doesn't start them -->
        <BaseButton v-if="!auth.isContractor" size="sm" :block="false" @click="creating = true">{{ $t('projects.new') }}</BaseButton>
      </template>
    </PageHeader>

    <div v-if="projects.loaded && !projects.projects.length" class="mt-6 flex min-h-0 flex-1 flex-col">
      <EmptyState
        class="flex-1 justify-center"
        :title="$t('projects.noneYet')"
        :description="auth.isClient ? $t('projects.noneYetClient') : $t('projects.noneYetFreelancer')"
      >
        <template #illustration>
          <ProjectIllustration />
        </template>
        <template v-if="!auth.isContractor" #default>
          <BaseButton size="sm" :block="false" @click="creating = true">{{ $t('projects.new') }}</BaseButton>
        </template>
      </EmptyState>
    </div>

    <template v-else-if="projects.projects.length">
      <p v-if="!shown.length" class="mt-8 text-center text-sm text-neutral-400">{{ $t('projects.noMatch', { query: query.trim() }) }}</p>

      <!-- cards -->
      <ul v-else-if="view === 'cards'" class="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <li v-for="p in shown" :key="p.id">
          <RouterLink
            :to="{ name: 'project-detail', params: { id: p.id } }"
            class="group flex h-full flex-col rounded-xl border border-neutral-200 bg-white p-5 shadow-xs transition-all hover:border-neutral-300 hover:shadow-sm"
          >
            <div class="flex items-start gap-3">
              <span class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-neutral-100 text-neutral-500" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-4.5 w-4.5">
                  <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                </svg>
              </span>
              <div class="min-w-0 flex-1">
                <p class="truncate font-semibold text-neutral-900">{{ p.name }}</p>
                <p class="mt-0.5 text-xs text-neutral-400">{{ $t('projects.updated', { date: formatDate(p.updated_at) }) }}</p>
              </div>
            </div>

            <p class="mt-3 line-clamp-2 min-h-10 text-sm text-neutral-500">{{ p.description || $t('projects.noDescription') }}</p>

            <div class="mt-auto pt-4">
              <p class="text-xs text-neutral-500">{{ $t('projects.openTotal', { open: p.open_tasks, total: p.total_tasks }) }}</p>
              <div class="mt-3 border-t border-neutral-100 pt-3">
                <AvatarStack :people="p.participants ?? []" size="md" />
              </div>
            </div>
          </RouterLink>
        </li>
      </ul>

      <!-- list -->
      <div v-else class="mt-5 overflow-hidden rounded-xl border border-neutral-200">
        <div
          class="hidden gap-4 border-b border-neutral-200 bg-neutral-50 px-4 py-2 text-xs font-medium tracking-wide text-neutral-500 uppercase md:grid md:grid-cols-[minmax(0,1fr)_9rem_7rem_7rem]"
          aria-hidden="true"
        >
          <span>{{ $t('projects.project') }}</span>
          <span>{{ $t('projects.participants') }}</span>
          <span>{{ $t('projects.open') }}</span>
          <span class="text-right">{{ $t('projects.updatedColumn') }}</span>
        </div>
        <ul class="divide-y divide-neutral-100">
          <li v-for="p in shown" :key="p.id">
            <RouterLink
              :to="{ name: 'project-detail', params: { id: p.id } }"
              class="grid grid-cols-1 gap-x-4 gap-y-2 px-4 py-3 transition-colors hover:bg-neutral-50 md:grid-cols-[minmax(0,1fr)_9rem_7rem_7rem] md:items-center"
            >
              <div class="flex min-w-0 items-center gap-3">
                <span class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-neutral-100 text-neutral-500" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-4 w-4">
                    <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                  </svg>
                </span>
                <div class="min-w-0">
                  <p class="truncate text-sm font-medium text-neutral-900">{{ p.name }}</p>
                  <p v-if="p.description" class="truncate text-xs text-neutral-500">{{ p.description }}</p>
                </div>
              </div>

              <AvatarStack class="justify-self-start" :people="p.participants ?? []" size="md" />

              <div class="text-sm text-neutral-700">
                <span class="md:hidden text-neutral-500">{{ $t('projects.openColon') }} </span>{{ p.open_tasks }}<span class="text-neutral-400"> / {{ p.total_tasks }}</span>
              </div>

              <div class="text-sm text-neutral-500 md:text-right">{{ formatDate(p.updated_at) }}</div>
            </RouterLink>
          </li>
        </ul>
      </div>
    </template>

    <ProjectFormModal v-if="creating" :people="counterparts" @close="creating = false" @saved="onSaved" />
  </DashboardLayout>
</template>
