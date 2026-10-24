<script setup lang="ts">
/** The dashboard's projects: the three with the most open tasks, each with how far along it is. */
import { computed } from 'vue'
import { RouterLink } from 'vue-router'
import ProgressRing from '@/components/dashboard/ProgressRing.vue'
import { useAuthStore } from '@/stores/auth'
import { useProjectsStore } from '@/stores/projects'

defineProps<{ loaded: boolean }>()

const auth = useAuthStore()
const projects = useProjectsStore()

const activeProjects = computed(() =>
  [...projects.projects]
    .filter((p) => p.total_tasks > 0)
    .sort((a, b) => b.open_tasks - a.open_tasks || a.name.localeCompare(b.name))
    .slice(0, 3),
)

function progress(p: { open_tasks: number; total_tasks: number }): number {
  return Math.round(((p.total_tasks - p.open_tasks) / p.total_tasks) * 100)
}
</script>

<template>
  <section class="rounded-2xl border border-neutral-200/80 bg-white shadow-[0_1px_2px_rgb(0_0_0/0.04)] flex flex-col" aria-labelledby="dash-projects">
    <header class="flex items-start justify-between px-5 pt-5 pb-2">
      <div>
        <h2 id="dash-projects" class="text-sm font-semibold text-neutral-900">{{ $t('dashboard.projects') }}</h2>
        <p class="mt-0.5 text-xs text-neutral-500">{{ $t('dashboard.projectsCaption') }}</p>
      </div>
      <RouterLink to="/projects" class="text-xs text-neutral-500 hover:text-neutral-900">{{ $t('dashboard.all') }}</RouterLink>
    </header>
    <ul v-if="activeProjects.length" class="px-2 pb-3">
      <li v-for="p in activeProjects" :key="p.id">
        <RouterLink
          :to="{ name: 'project-detail', params: { id: p.id } }"
          class="flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-neutral-50"
        >
          <ProgressRing :percent="progress(p)" />
          <div class="min-w-0 flex-1">
            <p class="truncate text-sm font-medium text-neutral-900">
              {{ p.name }}
            </p>
            <p class="truncate text-xs text-neutral-500">
              <template v-if="p.open_tasks">{{ $t('dashboard.openOf', { n: p.open_tasks }) }}</template>
              {{
                $t('dashboard.closedOf', {
                  closed: p.total_tasks - p.open_tasks,
                  total: p.total_tasks,
                })
              }}
            </p>
          </div>
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            class="h-4 w-4 shrink-0 text-neutral-300"
            aria-hidden="true"
          >
            <path d="m9 18 6-6-6-6" />
          </svg>
        </RouterLink>
      </li>
    </ul>
    <p v-else class="flex flex-1 items-center justify-center px-5 pt-2 pb-8 text-center text-sm text-neutral-400">
      <template v-if="!loaded">{{ $t('common.loading') }}</template>
      <template v-else>
        {{ $t('dashboard.noProjects') }}
        <RouterLink v-if="!auth.isContractor" to="/projects" class="font-medium text-neutral-700 underline-offset-4 hover:underline">{{
          $t('dashboard.createOne')
        }}</RouterLink>
      </template>
    </p>
  </section>
</template>
