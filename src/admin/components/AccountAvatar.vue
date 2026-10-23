<script setup lang="ts">
/** An account's initials in a circle, toned by its email so people tell rows apart at a glance. */
import { computed } from 'vue'

const props = withDefaults(defineProps<{ name: string; email: string; size?: 'md' | 'lg' }>(), { size: 'md' })

const TONES = ['bg-sky-50 text-sky-700', 'bg-violet-50 text-violet-700', 'bg-amber-50 text-amber-700', 'bg-teal-50 text-teal-700', 'bg-pink-50 text-pink-700', 'bg-orange-50 text-orange-700']

const initials = computed(() => {
  const words = props.name.split(/\s+/).filter(Boolean)
  if (words.length) return words.slice(0, 2).map((w) => w[0]).join('').toUpperCase()
  return props.email.slice(0, 2).toUpperCase()
})
const tone = computed(() => TONES[[...props.email].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 0) % TONES.length])
</script>

<template>
  <span
    class="flex shrink-0 items-center justify-center rounded-full font-semibold"
    :class="[tone, size === 'lg' ? 'h-11 w-11 text-sm' : 'h-8 w-8 text-xs']"
    aria-hidden="true"
    >{{ initials }}</span
  >
</template>
