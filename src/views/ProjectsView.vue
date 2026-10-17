<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import DashboardLayout from '@/layouts/DashboardLayout.vue'
import PageHeader from '@/components/ui/PageHeader.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import ViewToggle, { type ViewOption } from '@/components/ui/ViewToggle.vue'
import ProjectFormModal from '@/components/projects/ProjectFormModal.vue'
import { useAuthStore } from '@/stores/auth'
import { useProjectsStore } from '@/stores/projects'
import { usePeopleStore } from '@/stores/people'
import { useViewMode } from '@/composables/useViewMode'
import { formatDate } from '@/utils/format'
import { toast } from '@/composables/useToasts'
import type { Project } from '@/types/projects'

const auth = useAuthStore()
const projects = useProjectsStore()
const people = usePeopleStore()
const router = useRouter()
const creating = ref(false)
const query = ref('')

const VIEWS: ViewOption<'cards' | 'list'>[] = [
  { value: 'cards', label: 'Cards', icon: 'cards' },
  { value: 'list', label: 'List', icon: 'list' },
]
const view = useViewMode('helpic:projects-view', ['cards', 'list'] as const, 'cards')

const counterparts = computed(() => (auth.isClient ? people.freelancers : people.clients))

/** Projects matching the search, by name or description. */
const shown = computed(() => {
  const q = query.value.trim().toLowerCase()
  if (!q) return projects.projects
  return projects.projects.filter((p) => p.name.toLowerCase().includes(q) || p.description.toLowerCase().includes(q))
})

function other(p: Project) {
  return auth.isClient ? p.freelancer : p.client
}

function initials(name: string): string {
  const words = name.split(/\s+/).filter(Boolean)
  return (words.length > 1 ? words[0][0] + words[1][0] : name.slice(0, 2)).toUpperCase()
}

/** Who created the project — its owner — among its two sides. */
function owner(p: Project) {
  return p.created_by === p.freelancer.id ? p.freelancer : (p.client ?? p.freelancer)
}

function ownerName(p: Project): string {
  const o = owner(p)
  return o.id === auth.user?.id ? 'You' : o.name || o.email
}

onMounted(async () => {
  try {
    await Promise.all([projects.fetchProjects(), auth.isClient ? people.fetchFreelancers() : people.fetchClients()])
  } catch {
    toast.error('Could not load projects')
  }
})

function onSaved(project: Project) {
  creating.value = false
  void router.push({ name: 'project-detail', params: { id: project.id } })
}
</script>

<template>
  <DashboardLayout>
    <PageHeader title="Projects">
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
            placeholder="Search projects"
            aria-label="Search projects"
            class="h-8 w-full rounded-lg border border-neutral-200 bg-white pr-3 pl-9 text-sm text-neutral-900 shadow-xs placeholder:text-neutral-400 focus:border-neutral-900 focus:ring-2 focus:ring-neutral-900/10 focus:outline-none"
          />
        </div>
        <ViewToggle v-model="view" :options="VIEWS" />
        <BaseButton size="sm" :block="false" @click="creating = true">New project</BaseButton>
      </template>
    </PageHeader>

    <div v-if="projects.loaded && !projects.projects.length" class="mt-6">
      <EmptyState
        title="No projects yet"
        :description="
          auth.isClient
            ? 'Start a project with your freelancer to keep its tasks together.'
            : 'Create a project for a client, or a personal one, to keep its tasks together.'
        "
      >
        <BaseButton size="sm" :block="false" @click="creating = true">New project</BaseButton>
      </EmptyState>
    </div>

    <template v-else-if="projects.projects.length">
      <p v-if="!shown.length" class="mt-8 text-center text-sm text-neutral-400">No projects match “{{ query.trim() }}”.</p>

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
                <p class="mt-0.5 text-xs text-neutral-400">Updated {{ formatDate(p.updated_at) }}</p>
              </div>
            </div>

            <p class="mt-3 line-clamp-2 min-h-10 text-sm text-neutral-500">{{ p.description || 'No description.' }}</p>

            <div class="mt-auto pt-4">
              <p class="text-xs text-neutral-500">{{ p.open_tasks }} open · {{ p.total_tasks }} total</p>

              <dl class="mt-3 grid grid-cols-[4.5rem_minmax(0,1fr)] items-center gap-y-2 border-t border-neutral-100 pt-3 text-sm">
                <dt class="text-xs text-neutral-400">Owner</dt>
                <dd class="flex min-w-0 items-center gap-2">
                  <span class="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-[10px] font-semibold text-neutral-600" aria-hidden="true">
                    {{ initials(owner(p).name || owner(p).email) }}
                  </span>
                  <span class="truncate text-neutral-700">{{ ownerName(p) }}</span>
                </dd>
                <dt class="text-xs text-neutral-400">{{ auth.isClient ? 'Freelancer' : 'Client' }}</dt>
                <dd class="flex min-w-0 items-center gap-2">
                  <template v-if="other(p)">
                    <span class="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-[10px] font-semibold text-neutral-600" aria-hidden="true">
                      {{ initials(other(p)?.name || other(p)?.email || '?') }}
                    </span>
                    <span class="truncate text-neutral-700">{{ other(p)?.name || other(p)?.email }}</span>
                  </template>
                  <span v-else class="text-neutral-400">Personal project</span>
                </dd>
              </dl>
            </div>
          </RouterLink>
        </li>
      </ul>

      <!-- list -->
      <div v-else class="mt-5 overflow-hidden rounded-xl border border-neutral-200">
        <div
          class="hidden gap-4 border-b border-neutral-200 bg-neutral-50 px-4 py-2 text-xs font-medium tracking-wide text-neutral-500 uppercase md:grid md:grid-cols-[minmax(0,1fr)_11rem_11rem_5rem_7rem]"
          aria-hidden="true"
        >
          <span>Project</span>
          <span>Owner</span>
          <span>{{ auth.isClient ? 'Freelancer' : 'Client' }}</span>
          <span class="text-right">Open</span>
          <span class="text-right">Updated</span>
        </div>
        <ul class="divide-y divide-neutral-100">
          <li v-for="p in shown" :key="p.id">
            <RouterLink
              :to="{ name: 'project-detail', params: { id: p.id } }"
              class="grid grid-cols-1 gap-x-4 gap-y-2 px-4 py-3 transition-colors hover:bg-neutral-50 md:grid-cols-[minmax(0,1fr)_11rem_11rem_5rem_7rem] md:items-center"
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

              <div class="flex min-w-0 items-center gap-2 text-sm">
                <span class="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-[10px] font-semibold text-neutral-600" aria-hidden="true">
                  {{ initials(owner(p).name || owner(p).email) }}
                </span>
                <span class="truncate text-neutral-700"><span class="text-neutral-500 md:hidden">Owner: </span>{{ ownerName(p) }}</span>
              </div>

              <div class="flex min-w-0 items-center gap-2 text-sm">
                <template v-if="other(p)">
                  <span class="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-[10px] font-semibold text-neutral-600" aria-hidden="true">
                    {{ initials(other(p)?.name || other(p)?.email || '?') }}
                  </span>
                  <span class="truncate text-neutral-700">{{ other(p)?.name || other(p)?.email }}</span>
                </template>
                <span v-else class="text-neutral-400">Personal</span>
              </div>

              <div class="text-sm text-neutral-700 md:text-right">
                <span class="md:hidden text-neutral-500">Open: </span>{{ p.open_tasks }}<span class="text-neutral-400"> / {{ p.total_tasks }}</span>
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
