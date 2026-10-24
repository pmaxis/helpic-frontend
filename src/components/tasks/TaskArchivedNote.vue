<script setup lang="ts">
/** A task closed for good: when, what archived it, and that it stays as it is. */
import { RouterLink } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { formatDate } from '@/utils/format'
import type { Task } from '@/types/tasks'

defineProps<{ archivedAt: string; archivedBy: Task['archived_by'] }>()

const auth = useAuthStore()
</script>

<template>
  <p class="mt-5 flex flex-wrap items-center gap-x-1.5 gap-y-1 rounded-lg bg-neutral-50 px-3 py-2 text-sm text-neutral-600 ring-1 ring-neutral-200 ring-inset">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-4 w-4 shrink-0 text-neutral-400" aria-hidden="true">
      <rect x="2" y="4" width="20" height="5" rx="1" />
      <path d="M4 9v9a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9" />
      <path d="M10 13h4" />
    </svg>
    <span>{{ $t('task.archivedOn', { date: formatDate(archivedAt) }) }}</span>
    <template v-if="archivedBy">
      <span>·</span>
      <i18n-t keypath="task.archivedByReport" tag="span" scope="global">
        <template #report>
          <!-- reports are the company owner's: a team member sees only the title -->
          <span v-if="auth.isTeamMember" class="font-medium text-neutral-900">{{ archivedBy.title }}</span>
          <RouterLink v-else :to="{ name: 'report-detail', params: { id: archivedBy.id } }" class="font-medium text-neutral-900 underline-offset-4 hover:underline">{{ archivedBy.title }}</RouterLink>
        </template>
      </i18n-t>
    </template>
    <span class="text-neutral-400">· {{ $t('task.archivedClosed') }}</span>
  </p>
</template>
