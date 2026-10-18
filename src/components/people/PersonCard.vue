<script setup lang="ts">
import { formatDate } from '@/utils/format'
import type { Link } from '@/types/people'

defineProps<{ person: Link }>()

function initials(name: string): string {
  const words = name.split(/\s+/).filter(Boolean)
  return (words.length > 1 ? words[0][0] + words[1][0] : name.slice(0, 2)).toUpperCase()
}
</script>

<template>
  <article class="flex h-full flex-col rounded-xl border border-neutral-200 bg-white p-5 shadow-xs">
    <div class="flex items-start gap-3">
      <span
        class="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-sm font-semibold text-neutral-700 ring-1 ring-neutral-200"
        aria-hidden="true"
      >
        {{ initials(person.name || person.email) }}
      </span>
      <div class="min-w-0 flex-1 pt-0.5">
        <p class="truncate font-semibold text-neutral-900">{{ person.name || person.email }}</p>
        <p v-if="person.name" class="truncate text-sm text-neutral-500">{{ person.email }}</p>
      </div>
    </div>

    <div class="mt-5 flex items-center justify-between gap-3 border-t border-neutral-100 pt-4">
      <span
        class="inline-flex min-w-0 items-center rounded-full px-2.5 py-1 text-xs font-medium"
        :class="person.open_tasks ? 'bg-neutral-900 text-white' : 'bg-neutral-100 text-neutral-500'"
      >
        {{ $t('people.openTasks', { n: person.open_tasks }, person.open_tasks) }}
      </span>
      <p class="shrink-0 text-xs text-neutral-400">{{ $t('people.linked', { date: formatDate(person.linked_at) }) }}</p>
    </div>
  </article>
</template>
