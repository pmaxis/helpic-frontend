<script setup lang="ts">
/**
 * A task opened by its public link, for anyone, signed in or not: its title,
 * status, due date and description, its subtasks and its files, read-only.
 * Nothing about the people on it, the price, the time or the comments.
 *
 * Laid out as signing in is: the task on the light side — where it stands,
 * its description, its subtasks with how far along they are, the pictures as
 * a gallery and the other files as a list, each opening in the file viewer —
 * and on the dark one, standing still while it scrolls, what Helpic is, with
 * reactions to click, just for fun.
 * Nothing of the task goes there. On a phone, the light side alone. A link
 * that was turned off, or mistyped, says so.
 */
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'
import { useI18n } from 'vue-i18n'
import AppLogo from '@/components/ui/AppLogo.vue'
import LocaleSwitcher from '@/components/ui/LocaleSwitcher.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import LegalFooter from '@/components/policies/LegalFooter.vue'
import ReactionShowcase from '@/components/tasks/ReactionShowcase.vue'
import StatusBadge from '@/components/tasks/StatusBadge.vue'
import AttachmentViewer, { type ViewerSource } from '@/components/tasks/AttachmentViewer.vue'
import { APP_NAME } from '@/config'
import { STATUS_DOT } from '@/constants/tasks'
import { ApiRequestError } from '@/services/api'
import { downloadSharedFile, fetchSharedTask, sharedFileBlob, sharedFileURL } from '@/services/shares'
import { fileExtension, formatSize } from '@/services/attachments'
import { useAuthStore } from '@/stores/auth'
import { toast } from '@/composables/useToasts'
import { formatDate } from '@/utils/format'
import type { SharedFile, SharedTask } from '@/types/shares'

const props = defineProps<{ token: string }>()

const { t } = useI18n()
const auth = useAuthStore()
const home = computed(() => (auth.isAdmin ? '/admin' : auth.isAuthenticated ? '/dashboard' : '/login'))

const task = ref<SharedTask | null>(null)
/** "gone" for a link that opens nothing, "failed" for anything else. */
const problem = ref<'gone' | 'failed' | null>(null)
/** Image files' previews, as object URLs. */
const previews = ref<Record<string, string>>({})
/** The file viewer, open on one of the files that open. */
const viewerOpen = ref(false)
const viewIndex = ref(0)

function revokePreviews() {
  for (const url of Object.values(previews.value)) URL.revokeObjectURL(url)
  previews.value = {}
}

async function load() {
  problem.value = null
  task.value = null
  viewerOpen.value = false
  revokePreviews()
  try {
    task.value = await fetchSharedTask(props.token)
  } catch (error) {
    problem.value = error instanceof ApiRequestError && error.status === 404 ? 'gone' : 'failed'
    return
  }
  for (const f of images.value) {
    sharedFileURL(props.token, f, true)
      .then((url) => (previews.value = { ...previews.value, [f.id]: url }))
      .catch(() => {})
  }
}
watch(() => props.token, load, { immediate: true })
onBeforeUnmount(revokePreviews)

// The page is for whoever was sent the link, not for search engines.
let robots: HTMLMetaElement | null = null
onMounted(() => {
  robots = document.createElement('meta')
  robots.name = 'robots'
  robots.content = 'noindex, nofollow'
  document.head.appendChild(robots)
})
onBeforeUnmount(() => robots?.remove())

// --- when it's due ----------------------------------------------------------------

/** Whole days from today to the due date: negative once it's past. */
const daysLeft = computed(() => {
  const due = task.value?.due_on
  if (!due) return null
  const [y, m, d] = due.split('-').map(Number)
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  return Math.round((new Date(y, m - 1, d).getTime() - today.getTime()) / 86_400_000)
})

/** "in 3 days", "today", "2 days overdue" — nothing once the task is done. */
const dueHint = computed(() => {
  const n = daysLeft.value
  if (n === null || task.value?.status === 'done') return ''
  if (n === 0) return t('shared.dueToday')
  if (n === 1) return t('shared.dueTomorrow')
  return n > 0 ? t('shared.dueIn', n) : t('shared.overdueBy', -n)
})

const overdue = computed(() => daysLeft.value !== null && daysLeft.value < 0 && task.value?.status !== 'done')

// --- subtasks and files -------------------------------------------------------------

const doneSubtasks = computed(() => task.value?.subtasks.filter((s) => s.status === 'done').length ?? 0)
const progress = computed(() => (task.value?.subtasks.length ? Math.round((doneSubtasks.value / task.value.subtasks.length) * 100) : 0))

function downloadable(f: SharedFile): boolean {
  return f.scan === 'clean' || f.scan === 'unscanned'
}

/** Pictures that can be shown go in the gallery; everything else in the list. */
const images = computed(() => task.value?.files.filter((f) => f.is_image && downloadable(f)) ?? [])
const others = computed(() => task.value?.files.filter((f) => !(f.is_image && downloadable(f))) ?? [])

/** The files the viewer goes through: the ones that open. */
const viewable = computed(() => task.value?.files.filter(downloadable) ?? [])

function open(f: SharedFile) {
  const i = viewable.value.findIndex((v) => v.id === f.id)
  if (i < 0) return
  viewIndex.value = i
  viewerOpen.value = true
}

const source: ViewerSource = {
  blob: (f, inline) => sharedFileBlob(props.token, f, inline),
  download: (f) => downloadSharedFile(props.token, f),
}

function download(f: SharedFile) {
  downloadSharedFile(props.token, f).catch(() => toast.error(t('attachments.downloadFailed', { name: f.file_name })))
}

// --- the dark side --------------------------------------------------------------------

/** Where the soft light over the dark side is: it follows the pointer. */
const light = ref({ x: '75%', y: '15%' })

function onPointerMove(e: PointerEvent) {
  const r = (e.currentTarget as HTMLElement).getBoundingClientRect()
  light.value = { x: `${e.clientX - r.left}px`, y: `${e.clientY - r.top}px` }
}
</script>

<template>
  <main class="grid min-h-full bg-white lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
    <!-- The task -->
    <div class="flex min-h-full min-w-0 flex-col bg-neutral-50 px-5 py-6 sm:px-10">
      <div class="flex items-center justify-between gap-4">
        <RouterLink :to="home" :aria-label="APP_NAME">
          <AppLogo />
        </RouterLink>
        <LocaleSwitcher />
      </div>

      <div class="mx-auto w-full max-w-[38rem] flex-1 py-12 lg:py-16">
        <!-- a link that opens nothing -->
        <div v-if="problem" class="flex flex-col items-start">
          <span class="flex h-11 w-11 items-center justify-center rounded-full bg-neutral-200/70 text-neutral-500" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-5 w-5">
              <path d="M9 17H7A5 5 0 0 1 7 7h2" />
              <path d="M15 7h2a5 5 0 0 1 4 8" />
              <line x1="8" y1="12" x2="12" y2="12" />
              <line x1="2" y1="2" x2="22" y2="22" />
            </svg>
          </span>
          <h1 class="mt-5 text-2xl font-semibold tracking-tight text-neutral-900">{{ problem === 'gone' ? $t('shared.goneTitle') : $t('shared.failedTitle') }}</h1>
          <p class="mt-2 text-sm leading-6 text-neutral-600">{{ problem === 'gone' ? $t('shared.goneText') : $t('shared.failedText') }}</p>
          <BaseButton v-if="problem === 'failed'" class="mt-6" variant="ghost" size="sm" :block="false" @click="load">{{ $t('shared.retry') }}</BaseButton>
        </div>

        <!-- loading -->
        <div v-else-if="!task" class="space-y-3" aria-hidden="true">
          <div class="h-3 w-28 animate-pulse rounded bg-neutral-200/70" />
          <div class="h-8 w-2/3 animate-pulse rounded bg-neutral-200/70" />
          <div class="h-px" />
          <div v-for="i in 6" :key="i" class="h-3.5 animate-pulse rounded bg-neutral-200/70" :class="i === 6 ? 'w-1/2' : 'w-full'" />
        </div>

        <article v-else>
          <p class="flex items-center gap-2 text-xs font-semibold tracking-wide text-neutral-500 uppercase">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-3.5 w-3.5" aria-hidden="true">
              <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
              <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
            </svg>
            {{ $t('shared.eyebrow') }}
          </p>
          <h1 class="mt-3 text-3xl font-semibold tracking-tight break-words text-neutral-900 sm:text-4xl">{{ task.title }}</h1>
          <!-- where it stands -->
          <div class="mt-4 flex flex-wrap items-center gap-2">
            <StatusBadge :status="task.status" :name="task.status_name" />
            <span
              v-if="task.due_on"
              class="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset"
              :class="overdue ? 'bg-red-50 text-red-700 ring-red-200' : 'bg-white text-neutral-700 ring-neutral-200'"
            >
              {{ $t('shared.due', { date: formatDate(task.due_on) }) }}
              <template v-if="dueHint">· {{ dueHint }}</template>
            </span>
            <span v-if="task.archived" class="inline-flex items-center rounded-full bg-neutral-100 px-2 py-0.5 text-xs font-medium text-neutral-600 ring-1 ring-neutral-200 ring-inset">
              {{ $t('shared.archived') }}
            </span>
          </div>
          <hr class="my-8 border-neutral-200" />

          <section aria-labelledby="shared-description">
            <h2 id="shared-description" class="text-xs font-semibold tracking-wide text-neutral-500 uppercase">{{ $t('task.description') }}</h2>
            <p v-if="task.description" class="mt-3 text-[15px] leading-7 whitespace-pre-wrap break-words text-neutral-800">{{ task.description }}</p>
            <p v-else class="mt-3 text-sm text-neutral-400 italic">{{ $t('task.noDescription') }}</p>
          </section>

          <section v-if="task.subtasks.length" aria-labelledby="shared-subtasks" class="mt-10">
            <div class="flex items-center justify-between gap-3">
              <h2 id="shared-subtasks" class="text-xs font-semibold tracking-wide text-neutral-500 uppercase">{{ $t('subtasks.title') }}</h2>
              <span class="text-xs text-neutral-500 tabular-nums">{{ $t('subtasks.progress', { done: doneSubtasks, total: task.subtasks.length }) }}</span>
            </div>
            <div
              class="mt-3 h-1.5 overflow-hidden rounded-full bg-neutral-200/70"
              role="progressbar"
              :aria-valuenow="progress"
              aria-valuemin="0"
              aria-valuemax="100"
              :aria-label="$t('subtasks.progress', { done: doneSubtasks, total: task.subtasks.length })"
            >
              <div class="h-full rounded-full bg-emerald-500 transition-[width]" :style="{ width: `${progress}%` }" />
            </div>
            <ul class="mt-4 divide-y divide-neutral-100 rounded-xl border border-neutral-200 bg-white">
              <li v-for="(s, i) in task.subtasks" :key="i" class="flex min-w-0 items-center gap-3 px-3.5 py-2.5">
                <span v-if="s.status === 'done'" class="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" class="h-3 w-3">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </span>
                <span v-else class="flex h-5 w-5 shrink-0 items-center justify-center rounded-full ring-2 ring-neutral-300 ring-inset" aria-hidden="true">
                  <span class="h-1.5 w-1.5 rounded-full" :class="STATUS_DOT[s.status]" />
                </span>
                <span class="min-w-0 flex-1 truncate text-sm" :class="s.status === 'done' ? 'text-neutral-500 line-through' : 'text-neutral-800'" :title="s.title">{{ s.title }}</span>
                <StatusBadge :status="s.status" :name="s.status_name" />
              </li>
            </ul>
          </section>

          <section v-if="task.files.length" aria-labelledby="shared-files" class="mt-10">
            <h2 id="shared-files" class="flex items-center gap-1.5 text-xs font-semibold tracking-wide text-neutral-500 uppercase">
              {{ $t('attachments.title') }}
              <span class="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-neutral-200 px-1.5 text-[11px] font-semibold tracking-normal text-neutral-700 tabular-nums">{{ task.files.length }}</span>
            </h2>

            <!-- pictures, as a gallery -->
            <ul v-if="images.length" class="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
              <li v-for="f in images" :key="f.id" class="min-w-0">
                <button
                  type="button"
                  class="group block w-full overflow-hidden rounded-xl border border-neutral-200 bg-neutral-100 text-left"
                  :aria-label="`${$t('attachments.open')} ${f.file_name}`"
                  @click="open(f)"
                >
                  <span class="block aspect-[4/3] overflow-hidden">
                    <img v-if="previews[f.id]" :src="previews[f.id]" alt="" class="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]" />
                    <span v-else class="block h-full w-full animate-pulse bg-neutral-200/60" />
                  </span>
                  <span class="block truncate border-t border-neutral-200 bg-white px-3 py-2 text-xs text-neutral-600" :title="f.file_name">{{ f.file_name }}</span>
                </button>
              </li>
            </ul>

            <!-- everything else, as a list -->
            <ul v-if="others.length" class="mt-4 grid gap-2 sm:grid-cols-2">
              <li v-for="f in others" :key="f.id" class="flex min-w-0 items-center gap-3 rounded-xl border border-neutral-200 bg-white p-2.5 pr-2">
                <span
                  class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-[10px] font-semibold tracking-wide"
                  :class="f.scan === 'infected' ? 'bg-red-50 text-red-600' : 'bg-neutral-100 text-neutral-500'"
                  aria-hidden="true"
                >
                  <span v-if="f.scan === 'pending'" class="h-4 w-4 animate-spin rounded-full border-2 border-neutral-300 border-t-neutral-700" />
                  <template v-else>{{ fileExtension(f.file_name) }}</template>
                </span>
                <div class="min-w-0 flex-1">
                  <button
                    v-if="downloadable(f)"
                    type="button"
                    class="block max-w-full truncate text-left text-sm font-medium text-neutral-800 underline-offset-4 hover:text-neutral-950 hover:underline"
                    :title="f.file_name"
                    @click="open(f)"
                  >
                    {{ f.file_name }}
                  </button>
                  <p v-else class="truncate text-sm font-medium" :class="f.scan === 'infected' ? 'text-neutral-400 line-through' : 'text-neutral-700'" :title="f.file_name">
                    {{ f.file_name }}
                  </p>
                  <p v-if="f.scan === 'pending'" class="truncate text-xs text-neutral-500">{{ $t('attachments.checking') }}</p>
                  <p v-else-if="f.scan === 'infected'" class="truncate text-xs text-red-600">{{ $t('shared.fileRemoved') }}</p>
                  <p v-else class="truncate text-xs text-neutral-400">{{ formatSize(f.size_bytes) }}</p>
                </div>
                <button
                  v-if="downloadable(f)"
                  type="button"
                  class="shrink-0 rounded-md p-1.5 text-neutral-400 transition hover:bg-neutral-100 hover:text-neutral-900"
                  :aria-label="$t('attachments.downloadNamed', { name: f.file_name })"
                  :title="$t('attachments.download')"
                  @click="download(f)"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-4 w-4" aria-hidden="true">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="7 10 12 15 17 10" />
                    <line x1="12" y1="15" x2="12" y2="3" />
                  </svg>
                </button>
              </li>
            </ul>
          </section>

          <!-- on a phone the dark side is gone: a guest is asked in here -->
          <div v-if="!auth.isAuthenticated" class="mt-12 rounded-xl border border-neutral-200 bg-white p-5 lg:hidden">
            <p class="text-sm font-semibold text-neutral-900">{{ $t('shared.promo.title', { app: APP_NAME }) }}</p>
            <p class="mt-1 text-sm text-neutral-600">{{ $t('shared.promo.text') }}</p>
            <RouterLink to="/register" class="mt-4 inline-flex h-9 items-center rounded-lg bg-neutral-900 px-4 text-sm font-medium text-white transition-colors hover:bg-neutral-800">
              {{ $t('shared.promo.cta') }}
            </RouterLink>
          </div>
        </article>
      </div>

      <LegalFooter />
    </div>

    <!-- What Helpic is, standing still while the task scrolls -->
    <aside class="light-palette relative hidden bg-neutral-950 text-white lg:block" :aria-label="$t('authLayout.about', { app: APP_NAME })">
      <div class="sticky top-0 flex h-screen flex-col justify-center overflow-hidden px-14 xl:px-20" @pointermove="onPointerMove">
        <!-- soft grid backdrop -->
        <svg class="pointer-events-none absolute inset-0 h-full w-full text-white/[0.05]" aria-hidden="true">
          <defs>
            <pattern id="shared-grid" width="32" height="32" patternUnits="userSpaceOnUse">
              <path d="M32 0H0v32" fill="none" stroke="currentColor" stroke-width="1" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#shared-grid)" />
        </svg>
        <div class="pointer-events-none absolute -top-32 -right-32 h-96 w-96 rounded-full bg-emerald-500/10 blur-3xl" aria-hidden="true" />
        <!-- a soft light that follows the pointer over the grid -->
        <div
          class="pointer-events-none absolute inset-0"
          :style="{ background: `radial-gradient(480px circle at ${light.x} ${light.y}, rgb(52 211 153 / 0.09), transparent 70%)` }"
          aria-hidden="true"
        />

        <div class="relative max-w-lg">
          <p class="text-xs font-semibold tracking-wider text-emerald-400 uppercase">{{ APP_NAME }}</p>
          <h2 class="mt-3 text-3xl leading-tight font-semibold tracking-tight">{{ $t('shared.promo.title', { app: APP_NAME }) }}</h2>
          <p class="mt-3 text-sm leading-relaxed text-neutral-400">{{ $t('shared.promo.text') }}</p>

          <!-- reactions to the task, just for fun -->
          <ReactionShowcase />

          <RouterLink
            :to="auth.isAuthenticated ? home : '/register'"
            class="mt-8 inline-flex h-10 items-center justify-center rounded-lg bg-white px-5 text-sm font-medium text-neutral-900 transition-colors hover:bg-neutral-200"
          >
            {{ auth.isAuthenticated ? $t('shared.promo.open', { app: APP_NAME }) : $t('shared.promo.cta') }}
          </RouterLink>
        </div>
      </div>
    </aside>

    <AttachmentViewer v-if="viewerOpen" v-model:index="viewIndex" :files="viewable" :previews="previews" :source="source" @close="viewerOpen = false" />
  </main>
</template>
