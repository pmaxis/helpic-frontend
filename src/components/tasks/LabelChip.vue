<script setup lang="ts">
/** A task label: its name on its color. */
import { computed } from 'vue'
import { LABEL_COLORS } from '@/constants/tasks'

const props = withDefaults(defineProps<{ name: string; color: string; size?: 'xs' | 'sm' }>(), { size: 'sm' })

const tone = computed(() => (LABEL_COLORS[props.color] ?? LABEL_COLORS.gray).chip)
</script>

<template>
  <span
    class="inline-flex max-w-full items-center truncate rounded-md font-medium ring-1 ring-inset"
    :class="[tone, size === 'xs' ? 'px-1.5 py-px text-[10px] leading-4' : 'px-2 py-0.5 text-xs']"
  >
    {{ name }}
  </span>
</template>
