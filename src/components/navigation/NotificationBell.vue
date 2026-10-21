<script setup lang="ts">
/**
 * The bell by the account at the bottom of the sidebar. A red dot shows there
 * are unread notifications; clicking opens the list above it.
 */
import { onBeforeUnmount, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useNotificationsStore } from '@/stores/notifications'
import { formatDate, timeAgo } from '@/utils/format'
import { columnName } from '@/constants/tasks'
import type { AppNotification } from '@/types/notifications'

const store = useNotificationsStore()
const router = useRouter()

const open = ref(false)
const button = ref<HTMLButtonElement | null>(null)
const panel = ref<HTMLElement | null>(null)
const panelStyle = ref<Record<string, string>>({})
const loading = ref(false)

const WIDTH = 360

function position() {
  const r = button.value?.getBoundingClientRect()
  if (!r) return
  panelStyle.value = {
    position: 'fixed',
    width: `${Math.min(WIDTH, window.innerWidth - 16)}px`,
    left: `${Math.max(8, Math.min(r.left - 8, window.innerWidth - WIDTH - 8))}px`,
    bottom: `${window.innerHeight - r.top + 8}px`,
  }
}

function onDocPointer(e: PointerEvent) {
  const t = e.target as Node
  if (!button.value?.contains(t) && !panel.value?.contains(t)) close()
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') close()
}

async function toggle() {
  if (open.value) return close()
  position()
  open.value = true
  document.addEventListener('pointerdown', onDocPointer, true)
  window.addEventListener('keydown', onKeydown)
  window.addEventListener('resize', position)
  if (!store.loaded) {
    loading.value = true
    try {
      await store.fetchAll()
    } finally {
      loading.value = false
    }
  }
}

function close() {
  open.value = false
  document.removeEventListener('pointerdown', onDocPointer, true)
  window.removeEventListener('keydown', onKeydown)
  window.removeEventListener('resize', position)
}
onBeforeUnmount(close)

/** The kinds the bell has words for; anything else is "changed". */
const PHRASED = new Set([
  'task_due_soon',
  'task_overdue',
  'task_created',
  'task_status',
  'task_updated',
  'task_deleted',
  'participant_added',
  'project_created',
  'project_invited',
  'client_joined',
  'member_joined',
  'report_sent',
  'report_paid',
  'comment_added',
  'attachment_added',
])

/** The message saying what happened, and what fills it: {who} goes in bold. */
function phrase(n: AppNotification): { key: string; who: string; subject: string; detail: string; date: string } {
  return {
    key: `bell.phrases.${PHRASED.has(n.kind) ? n.kind : 'other'}`,
    who: n.actor ? n.actor.name || n.actor.email : '',
    subject: `“${n.subject}”`,
    // A status change's detail is the column's name.
    detail: n.kind === 'task_status' ? columnName(n.detail) : n.detail,
    date: n.kind === 'task_overdue' ? formatDate(n.detail) : '',
  }
}

/** A reminder's badge: a clock before the due date, a warning after. */
function isReminder(n: AppNotification): boolean {
  return n.kind === 'task_due_soon' || n.kind === 'task_overdue'
}

function initials(n: AppNotification): string {
  if (!n.actor) return ''
  const name = n.actor.name || n.actor.email
  const words = name.split(/\s+/).filter(Boolean)
  return (words.length > 1 ? words[0][0] + words[1][0] : name.slice(0, 2)).toUpperCase()
}

async function openNotification(n: AppNotification) {
  close()
  void store.markRead(n.id).catch(() => {})
  if (n.report_id) await router.push({ name: 'report-detail', params: { id: n.report_id } })
  else if (n.task_id) await router.push({ name: 'task-detail', params: { id: n.task_id } })
  else if (n.project_id) await router.push({ name: 'project-detail', params: { id: n.project_id } })
  else if (n.kind === 'client_joined') await router.push('/clients')
  else if (n.kind === 'member_joined') await router.push('/team')
}
</script>

<template>
  <button
    ref="button"
    type="button"
    class="relative shrink-0 rounded-md p-1.5 text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-900 focus:outline-none"
    :class="open ? 'bg-neutral-100 text-neutral-900' : ''"
    :title="store.unread ? $t('bell.newCount', { n: store.unread }, store.unread) : $t('bell.title')"
    :aria-label="store.unread ? $t('bell.unreadAria', { n: store.unread }) : $t('bell.title')"
    :aria-expanded="open"
    @click="toggle"
  >
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-4 w-4" aria-hidden="true">
      <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
      <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
    </svg>
    <span v-if="store.unread" class="absolute top-1 right-1 h-2 w-2 rounded-full bg-red-500 ring-2 ring-white" aria-hidden="true" />
  </button>

  <Teleport to="body">
    <div
      v-if="open"
      ref="panel"
      :style="panelStyle"
      class="animate-pop-up z-[60] flex max-h-[min(32rem,80vh)] flex-col overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-xl shadow-black/10"
      role="dialog"
      :aria-label="$t('bell.title')"
    >
      <header class="flex shrink-0 items-center justify-between border-b border-neutral-200 px-4 py-3">
        <h2 class="text-sm font-semibold text-neutral-900">{{ $t('bell.title') }}</h2>
        <button
          v-if="store.unread"
          type="button"
          class="text-xs font-medium text-neutral-500 hover:text-neutral-900"
          @click="store.markAllRead().catch(() => {})"
        >
          {{ $t('bell.markAllRead') }}
        </button>
      </header>

      <p v-if="loading" class="px-4 py-10 text-center text-sm text-neutral-400">{{ $t('common.loading') }}</p>
      <div v-else-if="!store.items.length" class="px-4 py-10 text-center">
        <p class="text-sm font-medium text-neutral-700">{{ $t('bell.caughtUp') }}</p>
        <p class="mt-1 text-xs text-neutral-400">{{ $t('bell.caughtUpText') }}</p>
      </div>
      <ul v-else class="min-h-0 divide-y divide-neutral-100 overflow-y-auto">
        <li v-for="n in store.items" :key="n.id">
          <button
            type="button"
            class="flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-neutral-50"
            :class="n.read ? '' : 'bg-sky-50/40'"
            @click="openNotification(n)"
          >
            <span
              v-if="isReminder(n)"
              class="flex h-7 w-7 shrink-0 items-center justify-center rounded-full"
              :class="n.kind === 'task_overdue' ? 'bg-red-50 text-red-600' : 'bg-amber-50 text-amber-600'"
              aria-hidden="true"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-3.5 w-3.5">
                <template v-if="n.kind === 'task_overdue'">
                  <path d="M12 9v4" />
                  <path d="M12 17h.01" />
                  <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" />
                </template>
                <template v-else>
                  <circle cx="12" cy="12" r="9" />
                  <path d="M12 7v5l3 2" />
                </template>
              </svg>
            </span>
            <span
              v-else
              class="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-[10px] font-semibold text-neutral-600"
              aria-hidden="true"
            >
              {{ initials(n) }}
            </span>
            <span class="min-w-0 flex-1">
              <i18n-t :keypath="phrase(n).key" tag="span" class="block text-sm leading-snug text-neutral-700" scope="global">
                <template #who><span class="font-medium text-neutral-900">{{ phrase(n).who }}</span></template>
                <template #subject>{{ phrase(n).subject }}</template>
                <template #detail>{{ phrase(n).detail }}</template>
                <template #date>{{ phrase(n).date }}</template>
              </i18n-t>
              <span v-if="n.kind === 'comment_added' && n.detail" class="mt-0.5 line-clamp-2 text-xs text-neutral-500">“{{ n.detail }}”</span>
              <span class="mt-0.5 block text-xs text-neutral-400">{{ timeAgo(n.created_at) }}</span>
            </span>
            <span v-if="!n.read" class="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-sky-500" :aria-label="$t('bell.unread')" />
          </button>
        </li>
      </ul>
    </div>
  </Teleport>
</template>
