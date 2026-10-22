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
import ConfirmDialog from '@/components/ui/ConfirmDialog.vue'
import { useAuthStore } from '@/stores/auth'
import { useProjectsStore } from '@/stores/projects'
import { usePeopleStore } from '@/stores/people'
import { useViewMode } from '@/composables/useViewMode'
import { ApiRequestError } from '@/services/api'
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
/** The project being edited, or asked about before deleting, from its card's or row's buttons. */
const editing = ref<Project | null>(null)
const removing = ref<Project | null>(null)
const deleting = ref(false)
const confirmDelete = computed({
  get: () => !!removing.value,
  set: (open) => {
    if (!open) removing.value = null
  },
})

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

function onEdited() {
  editing.value = null
  toast.success(t('project.saved'))
}

async function remove() {
  const project = removing.value
  if (!project) return
  deleting.value = true
  try {
    await projects.deleteProject(project.id)
    toast.success(t('project.deleted'))
  } catch (error) {
    toast.error(error instanceof ApiRequestError ? error.message : t('project.deleteFailed'))
  } finally {
    deleting.value = false
    removing.value = null
  }
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
        <li v-for="p in shown" :key="p.id" class="group relative">
          <RouterLink
            :to="{ name: 'project-detail', params: { id: p.id } }"
            class="flex h-full flex-col rounded-xl border border-neutral-200 bg-white p-5 shadow-xs transition-all hover:border-neutral-300 hover:shadow-sm"
          >
            <div class="flex items-start gap-3">
              <span class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-neutral-100 text-neutral-500" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-4.5 w-4.5">
                  <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                </svg>
              </span>
              <!-- room for the edit and delete buttons laid over the card's corner -->
              <div class="min-w-0 flex-1" :class="p.can_edit ? 'pr-14' : ''">
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
          <div
            v-if="p.can_edit"
            class="absolute top-4 right-4 flex gap-0.5 rounded-lg bg-white opacity-0 transition focus-within:opacity-100 group-hover:opacity-100 [@media(hover:none)]:opacity-100"
          >
            <button
              type="button"
              class="inline-flex h-7 w-7 items-center justify-center rounded-md text-neutral-400 transition hover:bg-neutral-100 hover:text-neutral-900 focus-visible:opacity-100"
              :aria-label="$t('projects.editNamed', { name: p.name })"
              :title="$t('projects.edit')"
              @click="editing = p"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-3.5 w-3.5" aria-hidden="true">
                <path d="M12 20h9" />
                <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
              </svg>
            </button>
            <button
              type="button"
              class="inline-flex h-7 w-7 items-center justify-center rounded-md text-neutral-400 transition hover:bg-red-50 hover:text-red-600 focus-visible:opacity-100"
              :aria-label="$t('projects.deleteNamed', { name: p.name })"
              :title="$t('project.delete')"
              @click="removing = p"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-3.5 w-3.5" aria-hidden="true">
                <path d="M3 6h18" />
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
                <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                <line x1="10" x2="10" y1="11" y2="17" />
                <line x1="14" x2="14" y1="11" y2="17" />
              </svg>
            </button>
          </div>
        </li>
      </ul>

      <!-- list -->
      <div v-else class="mt-5 overflow-hidden rounded-xl border border-neutral-200">
        <!-- the last, unnamed column holds the row's edit and delete buttons -->
        <div class="hidden border-b border-neutral-200 bg-neutral-50 pr-18 md:block" aria-hidden="true">
          <div class="grid grid-cols-[minmax(0,1fr)_9rem_7rem_7rem] gap-4 px-4 py-2 text-xs font-medium tracking-wide text-neutral-500 uppercase">
            <span>{{ $t('projects.project') }}</span>
            <span>{{ $t('projects.participants') }}</span>
            <span>{{ $t('projects.open') }}</span>
            <span class="text-right">{{ $t('projects.updatedColumn') }}</span>
          </div>
        </div>
        <ul class="divide-y divide-neutral-100">
          <li v-for="p in shown" :key="p.id" class="group flex items-center transition-colors hover:bg-neutral-50">
            <RouterLink
              :to="{ name: 'project-detail', params: { id: p.id } }"
              class="grid min-w-0 flex-1 grid-cols-1 gap-x-4 gap-y-2 py-3 pl-4 md:grid-cols-[minmax(0,1fr)_9rem_7rem_7rem] md:items-center md:pr-4"
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
            <div class="flex w-18 shrink-0 justify-center gap-0.5 self-stretch pr-2 md:items-center max-md:pt-2.5">
              <template v-if="p.can_edit">
                <button
                  type="button"
                  class="inline-flex h-7 w-7 items-center justify-center rounded-md text-neutral-400 transition hover:bg-neutral-200/70 hover:text-neutral-900 focus-visible:opacity-100 md:opacity-0 md:group-hover:opacity-100 [@media(hover:none)]:opacity-100"
                  :aria-label="$t('projects.editNamed', { name: p.name })"
                  :title="$t('projects.edit')"
                  @click="editing = p"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-3.5 w-3.5" aria-hidden="true">
                    <path d="M12 20h9" />
                    <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
                  </svg>
                </button>
                <button
                  type="button"
                  class="inline-flex h-7 w-7 items-center justify-center rounded-md text-neutral-400 transition hover:bg-red-50 hover:text-red-600 focus-visible:opacity-100 md:opacity-0 md:group-hover:opacity-100 [@media(hover:none)]:opacity-100"
                  :aria-label="$t('projects.deleteNamed', { name: p.name })"
                  :title="$t('project.delete')"
                  @click="removing = p"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-3.5 w-3.5" aria-hidden="true">
                    <path d="M3 6h18" />
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
                    <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                    <line x1="10" x2="10" y1="11" y2="17" />
                    <line x1="14" x2="14" y1="11" y2="17" />
                  </svg>
                </button>
              </template>
            </div>
          </li>
        </ul>
      </div>
    </template>

    <ProjectFormModal v-if="creating" :people="counterparts" @close="creating = false" @saved="onSaved" />
    <ProjectFormModal v-if="editing" :project="editing" @close="editing = null" @saved="onEdited" />
    <ConfirmDialog
      v-model:open="confirmDelete"
      :title="$t('project.confirmDelete')"
      :description="$t('project.confirmDeleteText')"
      :loading="deleting"
      @confirm="remove"
    />
  </DashboardLayout>
</template>
