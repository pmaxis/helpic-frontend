<script setup lang="ts">
/**
 * The head of the tasks pages: the title, the backlog's icon button
 * and the new task button, and under them the views as tabs on the header's
 * rule: Board, then List. The filters (the project, and in the list the
 * statuses) sit at the right end of the tab row,
 * so the whole head is two quiet lines rather than a row of framed controls.
 * A tab given a link goes there; the others switch in place. The backlog is a
 * page of its own, not a view, with a head of its own (BacklogHead).
 *
 * A project's page wears the same head: it brings its own title (#title,
 * the crumbs "Projects / Landing"), a line under it (#description), and its
 * own controls before the backlog button (#actions: people, rate, settings).
 */
import { computed } from 'vue'
import { RouterLink, type RouteLocationRaw } from 'vue-router'
import BaseButton from '@/components/ui/BaseButton.vue'
import { t } from '@/i18n'

export type TasksTab = 'list' | 'board'

const props = defineProps<{
  /** The view in place. */
  active: TasksTab
  /** Tabs that are another page, and where they lead. */
  links?: Partial<Record<TasksTab, RouteLocationRaw>>
  /** Where the backlog button leads. */
  backlogTo: RouteLocationRaw
  /** What the backlog button says, when it isn't the tasks page's. */
  backlogLabel?: string
  /** How many tasks wait there: a badge on the button's corner, 99+ past that, none at 0. */
  backlogCount?: number | null
}>()

const emit = defineEmits<{
  'update:active': [tab: TasksTab]
  'new-task': []
}>()

const badge = computed(() => (props.backlogCount ? (props.backlogCount > 99 ? '99+' : String(props.backlogCount)) : ''))

const tabs = computed(() =>
  (['board', 'list'] as const).map((value) => ({ value, to: props.links?.[value], label: t(`ui.views.${value}`) })),
)
</script>

<template>
  <header class="border-b border-neutral-200">
    <div class="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
      <div class="flex min-w-0 items-center gap-2 text-2xl font-semibold tracking-tight">
        <slot v-if="$slots.title" name="title" />
        <h1 v-else class="shrink-0 text-neutral-900">{{ $t('tasks.title') }}</h1>
      </div>
      <div class="flex items-center gap-2">
        <slot name="actions" />
        <RouterLink
          :to="backlogTo"
          class="relative inline-flex h-8 w-8 items-center justify-center rounded-lg border border-neutral-300 bg-white text-neutral-500 shadow-xs transition-colors hover:bg-neutral-50 hover:text-neutral-900"
          :aria-label="badge ? `${backlogLabel ?? $t('backlog.open')} · ${$t('backlog.count', { n: backlogCount ?? 0 }, backlogCount ?? 0)}` : (backlogLabel ?? $t('backlog.open'))"
          :title="badge ? `${$t('backlog.open')} · ${$t('backlog.count', { n: backlogCount ?? 0 }, backlogCount ?? 0)}` : $t('backlog.open')"
          data-backlog-button
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-4 w-4" aria-hidden="true">
            <path d="M22 12h-6l-2 3h-4l-2-3H2" />
            <path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
          </svg>
          <!-- how many wait there, on the corner; ringed in the page's colour so it sits clear of the button's edge -->
          <span
            v-if="badge"
            class="absolute -top-1 -right-1 flex h-[15px] min-w-[15px] items-center justify-center rounded-full bg-neutral-900 px-[3px] text-[9px] leading-none font-semibold text-white tabular-nums ring-2 ring-white"
            aria-hidden="true"
            data-backlog-count
          >
            {{ badge }}
          </span>
        </RouterLink>
        <BaseButton size="sm" :block="false" @click="emit('new-task')">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" class="h-3.5 w-3.5" aria-hidden="true">
            <path d="M12 5v14M5 12h14" />
          </svg>
          {{ $t('tasks.newTask') }}
        </BaseButton>
      </div>
    </div>

    <slot name="description" />

    <div class="mt-3 flex flex-wrap items-end justify-between gap-x-4">
      <nav class="-mb-px flex gap-5" :aria-label="$t('ui.view')">
        <component
          :is="tab.to ? RouterLink : 'button'"
          v-for="tab in tabs"
          :key="tab.value"
          :to="tab.to"
          :type="tab.to ? undefined : 'button'"
          class="inline-flex items-center gap-1.5 border-b-2 pt-1 pb-2.5 text-sm font-medium transition-colors"
          :class="active === tab.value ? 'border-neutral-900 text-neutral-900' : 'border-transparent text-neutral-500 hover:border-neutral-300 hover:text-neutral-900'"
          :aria-current="active === tab.value ? 'page' : undefined"
          :data-view="tab.value"
          @click="tab.to ? undefined : emit('update:active', tab.value)"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-4 w-4" aria-hidden="true">
            <path v-if="tab.value === 'list'" d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />
            <template v-else>
              <rect x="3" y="3" width="5" height="18" rx="1" />
              <rect x="10" y="3" width="5" height="12" rx="1" />
              <rect x="17" y="3" width="4" height="8" rx="1" />
            </template>
          </svg>
          {{ tab.label }}
        </component>
      </nav>
      <!-- 32px and a 3px foot: as tall as a tab on the rule, so it stays put with or without filters -->
      <div v-if="$slots.filters" class="flex items-center gap-1 pb-[3px]" data-filters>
        <slot name="filters" />
      </div>
    </div>
  </header>
</template>
