<script setup lang="ts">
/** An account's history in the admin's card: what admins did to it, newest first, a page at a time. */
import { computed } from 'vue'
import { RouterLink } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { intlLocale } from '@/i18n'
import Pagination from '@/components/ui/Pagination.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import HistoryIllustration from '@/components/illustrations/HistoryIllustration.vue'
import type { AdminAction } from '../types'

const props = defineProps<{
  /** null while it loads. */
  history: AdminAction[] | null
  total: number
  page: number
  limit: number
}>()
const emit = defineEmits<{ 'update:page': [page: number] }>()
const { t } = useI18n()

const currentPage = computed({
  get: () => props.page,
  set: (page) => emit('update:page', page),
})

/** The dot of each action in the history. */
const DOTS: Record<AdminAction['action'], string> = {
  block: 'bg-red-500',
  unblock: 'bg-emerald-500',
  end_sessions: 'bg-amber-500',
  reset_two_factor: 'bg-amber-500',
  retry_email: 'bg-sky-500',
  resend_signup: 'bg-sky-500',
  delete_signup: 'bg-neutral-400',
  end_session: 'bg-amber-500',
  clear_limit: 'bg-sky-500',
  lock_admin: 'bg-red-500',
  unlock_admin: 'bg-emerald-500',
  reset_admin: 'bg-amber-500',
  delete: 'bg-red-500',
}

const dateTime = computed(() => new Intl.DateTimeFormat(intlLocale(), { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }))
const formatDateTime = (iso: string) => dateTime.value.format(new Date(iso))

/** A history entry's reason; a lifted limit's is the limit, named in the reader's language. */
function reasonText(h: AdminAction): string {
  return h.action === 'clear_limit' && h.reason ? t(`admin.limits.scopes.${h.reason}`) : h.reason
}
</script>

<template>
  <div class="flex min-h-0 flex-1 flex-col overflow-y-auto px-5 py-5">
    <div v-if="!history" class="space-y-3" aria-hidden="true">
      <div v-for="i in 3" :key="i" class="h-12 animate-pulse rounded-lg bg-neutral-100" />
    </div>
    <EmptyState v-else-if="!history.length" class="flex-1 justify-center" :title="$t('admin.actions.empty')" :description="$t('admin.manage.noHistory')">
      <template #illustration>
        <HistoryIllustration />
      </template>
    </EmptyState>
    <template v-else>
      <ol class="space-y-4 border-l border-neutral-200 pl-4">
        <li v-for="h in history" :key="h.id" class="relative">
          <span class="absolute top-1.5 -left-[21px] h-2.5 w-2.5 rounded-full ring-4 ring-white" :class="DOTS[h.action]" aria-hidden="true" />
          <p class="text-sm font-medium text-neutral-900">{{ $t(`admin.actions.names.${h.action}`) }}</p>
          <p class="text-xs text-neutral-500">{{ formatDateTime(h.at) }} · {{ h.admin_email }}</p>
          <p v-if="h.reason" class="mt-1 rounded-md bg-neutral-50 px-2.5 py-1.5 text-xs break-words text-neutral-700">{{ reasonText(h) }}</p>
        </li>
      </ol>
      <Pagination v-if="total > limit" v-model:page="currentPage" class="mt-5" :total="total" :limit="limit" />
      <RouterLink to="/admin/actions" class="mt-5 text-xs text-neutral-500 hover:text-neutral-900">{{ $t('admin.manage.allActions') }} →</RouterLink>
    </template>
  </div>
</template>
