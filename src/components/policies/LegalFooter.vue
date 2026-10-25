<script setup lang="ts">
/** The copyright and the policies, at the foot of the sign-in pages and of the policies themselves. */
import { RouterLink } from 'vue-router'
import { APP_NAME } from '@/config'
import { POLICY_KINDS, type PolicyKind } from '@/types/policies'

defineProps<{
  /** The policy open on the page, marked as the current one. */
  current?: PolicyKind
}>()

const year = new Date().getFullYear()
</script>

<template>
  <footer class="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 text-xs text-neutral-400">
    <p>{{ $t('authLayout.rights', { year, app: APP_NAME }) }}</p>
    <!-- short names, so the line and the links fit on one row -->
    <nav class="flex gap-3" :aria-label="$t('policies.nav')">
      <RouterLink
        v-for="k in POLICY_KINDS"
        :key="k"
        :to="`/${k}`"
        :title="$t(`policies.names.${k}`)"
        :aria-current="k === current ? 'page' : undefined"
        class="whitespace-nowrap transition-colors hover:text-neutral-700 aria-[current=page]:text-neutral-700"
      >
        {{ $t(`policies.short.${k}`) }}
      </RouterLink>
    </nav>
  </footer>
</template>
