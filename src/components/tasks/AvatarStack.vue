<script setup lang="ts">
/**
 * People as a row of overlapping initials — a task's participants on a card.
 * Shows up to `max`, then "+N"; each one's name is in its tooltip, and the
 * whole row reads as one label for screen readers.
 */
import { computed } from 'vue'
import { useAuthStore } from '@/stores/auth'
import type { Party } from '@/types/people'

const props = withDefaults(defineProps<{ people: Party[]; max?: number }>(), { max: 3 })

const auth = useAuthStore()

const shown = computed(() => props.people.slice(0, props.max))
const rest = computed(() => props.people.length - shown.value.length)

function name(p: Party): string {
  return p.id === auth.user?.id ? 'You' : p.name || p.email
}

function initials(p: Party): string {
  const words = (p.name || p.email).split(/\s+/).filter(Boolean)
  return (words.length > 1 ? words[0][0] + words[1][0] : (p.name || p.email).slice(0, 2)).toUpperCase()
}

const label = computed(() => props.people.map(name).join(', '))
</script>

<template>
  <span v-if="people.length" class="flex shrink-0 items-center -space-x-1.5" role="img" :aria-label="label" :title="label">
    <!-- the first sits on top, so the freelancer's initials are never covered -->
    <span
      v-for="(p, i) in shown"
      :key="p.id"
      class="relative flex h-5 w-5 items-center justify-center rounded-full text-[8px] font-semibold ring-2 ring-white"
      :style="{ zIndex: shown.length - i }"
      :class="p.id === auth.user?.id ? 'bg-neutral-900 text-white' : 'bg-neutral-200 text-neutral-700'"
      aria-hidden="true"
    >
      {{ initials(p) }}
    </span>
    <span
      v-if="rest > 0"
      class="flex h-5 min-w-5 items-center justify-center rounded-full bg-neutral-100 px-1 text-[9px] font-medium text-neutral-500 ring-2 ring-white"
      aria-hidden="true"
    >
      +{{ rest }}
    </span>
  </span>
</template>
