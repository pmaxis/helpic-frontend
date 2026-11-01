<script setup lang="ts">
/**
 * The head of a backlog page, the way a report's or a project's settings
 * read: small crumbs with a quiet back arrow ("← Projects › Landing ›
 * Backlog"), then the page's own title, a line under it, and its controls.
 * The last crumb is this page; the arrow leads to `backTo`.
 */
import type { RouteLocationRaw } from 'vue-router'
import PageCrumbs from '@/components/ui/PageCrumbs.vue'
import PageHeader from '@/components/ui/PageHeader.vue'

defineProps<{
  /** The way here, this page left out: each crumb links back. */
  crumbs: { label: string; to: RouteLocationRaw }[]
  backTo: RouteLocationRaw
  backLabel: string
  /** Under the title: the project, say. */
  description?: string
}>()
</script>

<template>
  <PageCrumbs :crumbs="crumbs" :current="$t('backlog.open')" :back-to="backTo" :back-label="backLabel" :label="$t('backlog.breadcrumb')" />

  <PageHeader class="mt-3" :title="$t('backlog.open')" :description="description">
    <template #actions>
      <slot name="actions" />
    </template>
  </PageHeader>
</template>
