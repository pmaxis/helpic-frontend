<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import NavIcon from './NavIcon.vue'

const props = withDefaults(
  defineProps<{
    icon: string
    label: string
    to: string
    /** Icon-only rendering when the sidebar is collapsed. */
    collapsed?: boolean
  }>(),
  {
    collapsed: false,
  },
)

const route = useRoute()
/** Active on the page itself and on the pages under it (/tasks/…, /projects/…). */
const active = computed(() => route.path === props.to || route.path.startsWith(`${props.to}/`))
</script>

<template>
  <RouterLink
    :to="to"
    :title="collapsed ? label : undefined"
    :class="[
      'flex items-center gap-3 rounded-md text-sm transition-colors hover:bg-neutral-100 hover:text-neutral-900',
      collapsed ? 'justify-center px-0 py-2' : 'px-3 py-2',
      active ? 'bg-neutral-100 font-medium text-neutral-900' : 'text-neutral-600',
    ]"
    :aria-current="active ? 'page' : undefined"
  >
    <NavIcon :name="icon" />
    <span v-show="!collapsed">{{ label }}</span>
  </RouterLink>
</template>
