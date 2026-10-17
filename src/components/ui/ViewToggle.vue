<script setup lang="ts" generic="T extends string">
// A segmented switch between a page's views — List / Board by default.
export interface ViewOption<V extends string = string> {
  value: V
  /** Shown as is; without it, the view's usual name ("List", "Board"). */
  label?: string
  icon: 'list' | 'board' | 'cards'
}

withDefaults(
  defineProps<{
    modelValue: T
    options?: ViewOption<T>[]
  }>(),
  {
    options: () =>
      [
        { value: 'list', icon: 'list' },
        { value: 'board', icon: 'board' },
      ] as unknown as ViewOption<T>[],
  },
)
const emit = defineEmits<{ 'update:modelValue': [value: T] }>()
</script>

<template>
  <!-- framed like a small button, so it lines up with the buttons next to it (32px) -->
  <div class="inline-flex h-8 items-center rounded-lg border border-neutral-200 bg-neutral-100 p-[3px] text-sm" role="group" :aria-label="$t('ui.view')">
    <button
      v-for="o in options"
      :key="o.value"
      type="button"
      class="inline-flex h-full items-center gap-1.5 rounded-md px-2.5 font-medium transition-colors"
      :class="modelValue === o.value ? 'bg-white text-neutral-900 shadow-xs' : 'text-neutral-500 hover:text-neutral-900'"
      :aria-pressed="modelValue === o.value"
      @click="emit('update:modelValue', o.value)"
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-3.5 w-3.5" aria-hidden="true">
        <path v-if="o.icon === 'list'" d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />
        <template v-else-if="o.icon === 'board'">
          <rect x="3" y="3" width="5" height="18" rx="1" />
          <rect x="10" y="3" width="5" height="12" rx="1" />
          <rect x="17" y="3" width="4" height="8" rx="1" />
        </template>
        <template v-else>
          <rect x="3" y="3" width="7" height="7" rx="1" />
          <rect x="14" y="3" width="7" height="7" rx="1" />
          <rect x="3" y="14" width="7" height="7" rx="1" />
          <rect x="14" y="14" width="7" height="7" rx="1" />
        </template>
      </svg>
      {{ o.label ?? $t(`ui.views.${o.icon}`) }}
    </button>
  </div>
</template>
