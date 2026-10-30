<script setup lang="ts">
/**
 * A task's files one at a time, in a modal: images, PDFs, videos, sound and
 * text shown in place, anything else with a way to download it. The arrows
 * (keys, buttons, a swipe) or the strip under the file go through the task's
 * files; Escape or a click outside closes it, as any modal.
 *
 * The files come from the signed-in API, or from wherever source says — a
 * task's public link; who uploaded a file and when are shown when known.
 *
 * On a task's own page a file also shows its earlier versions, the client's
 * side approves it or asks for changes, and an image takes comments on a
 * spot of it: numbered pins over the picture, their comments under it.
 */
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import Modal from '@/components/ui/Modal.vue'
import { useAuthStore } from '@/stores/auth'
import { attachmentBlob, downloadAttachment, fileExtension, formatSize, previewKind } from '@/services/attachments'
import { renderComment } from '@/utils/commentText'
import { formatDate, timeAgo } from '@/utils/format'
import { toast } from '@/composables/useToasts'
import { t } from '@/i18n'
import type { Attachment, FileReview } from '@/types/attachments'
import type { Comment } from '@/types/comments'

/** A file the viewer shows: an attachment, or less of one. */
export type ViewerFile = Pick<Attachment, 'id' | 'file_name' | 'content_type' | 'size_bytes' | 'is_image'> &
  Partial<Pick<Attachment, 'uploaded_by' | 'created_at' | 'series_id' | 'version' | 'review' | 'reviewed_by' | 'can_review'>>

/** What the task's page lets the viewer do beyond showing files. */
export interface ViewerReview {
  /** Every version of the file, oldest first. */
  versions: (f: ViewerFile) => ViewerFile[]
  /** Comments pinned to a spot of each image, by its id. */
  pins: Record<string, Comment[]>
  /** Whether the viewer may pin comments: the task isn't archived. */
  canPin: boolean
  /** Saves a comment on a spot of the image. */
  addPin: (f: ViewerFile, x: number, y: number, body: string) => Promise<void>
  /** Approves the file or asks for changes; null takes that back. */
  setReview: (f: ViewerFile, review: FileReview | null) => Promise<void>
}

/** Where the viewer gets a file's bytes, and saves it. */
export interface ViewerSource {
  blob: (f: ViewerFile, inline: boolean) => Promise<Blob>
  download: (f: ViewerFile) => Promise<void>
}

const props = defineProps<{
  files: ViewerFile[]
  /** The image previews the list has loaded already, by attachment id. */
  previews: Record<string, string>
  /** The signed-in API's attachments unless given. */
  source?: ViewerSource
  /** Versions, reviews and pinned comments; none on a public link. */
  review?: ViewerReview
}>()

const index = defineModel<number>('index', { required: true })
const emit = defineEmits<{ close: [] }>()

const auth = useAuthStore()

/** Text is shown up to this much; the rest is left to the download. */
const TEXT_LIMIT = 512 * 1024

/** The file open in the list, and the version of it shown: the latest unless an earlier one was picked. */
const open = computed<ViewerFile | undefined>(() => props.files[index.value])
const pickedVersion = ref<string | null>(null)
const versions = computed(() => (open.value && props.review ? props.review.versions(open.value) : []))
const current = computed<ViewerFile | undefined>(() => versions.value.find((v) => v.id === pickedVersion.value) ?? open.value)
const kind = computed(() => (current.value ? previewKind(current.value) : null))

/** What the viewer loaded itself, by attachment id: an object URL, or the text. */
interface Loaded {
  url?: string
  text?: string
  truncated?: boolean
}
const loaded = ref<Record<string, Loaded>>({})
/** The file being fetched, and one that couldn't be: each shows only while it's the one open. */
const pending = ref<string | null>(null)
const failedId = ref<string | null>(null)
const loading = computed(() => !!current.value && pending.value === current.value.id)
const failed = computed(() => !!current.value && failedId.value === current.value.id)

/** A picture fits the modal, or shows at its own size, scrolled. */
const zoomed = ref(false)
/** Clicking the image puts a pin down rather than zooming; the pin being written, and the one picked to read. */
const pinning = ref(false)
const draftPin = ref<{ x: number; y: number } | null>(null)
const activePin = ref<string | null>(null)

const shown = computed<Loaded | undefined>(() => {
  const a = current.value
  if (!a) return undefined
  if (kind.value === 'image' && props.previews[a.id]) return { url: props.previews[a.id] }
  return loaded.value[a.id]
})

async function load(a: ViewerFile) {
  const k = previewKind(a)
  if (!k || shown.value || pending.value === a.id) return
  if (failedId.value === a.id) failedId.value = null
  pending.value = a.id
  try {
    const blob = props.source ? await props.source.blob(a, k === 'image') : await attachmentBlob(a.id, k === 'image')
    let item: Loaded
    if (k === 'text') {
      item = { text: await blob.slice(0, TEXT_LIMIT).text(), truncated: blob.size > TEXT_LIMIT }
    } else {
      // Typed as the server read it, whatever the response said: never a page.
      item = { url: URL.createObjectURL(new Blob([blob], { type: a.content_type })) }
    }
    loaded.value = { ...loaded.value, [a.id]: item }
  } catch {
    failedId.value = a.id
  } finally {
    if (pending.value === a.id) pending.value = null
  }
}

watch(open, () => (pickedVersion.value = null))
watch(
  current,
  (a) => {
    zoomed.value = false
    pinning.value = false
    draftPin.value = null
    activePin.value = null
    if (a) void load(a)
    else emit('close')
  },
  { immediate: true },
)

// --- going through the files -----------------------------------------------------

const many = computed(() => props.files.length > 1)

function go(step: number) {
  if (!many.value) return
  index.value = (index.value + step + props.files.length) % props.files.length
}

function onKeydown(e: KeyboardEvent) {
  // Keys in a player or a field are theirs; Escape is the modal's.
  if (e.target instanceof Element && e.target.closest('video, audio, input, textarea')) return
  // Writing at a pin, the arrows stay put.
  if (draftPin.value) return
  if (e.key === 'ArrowLeft') go(-1)
  else if (e.key === 'ArrowRight') go(1)
  else return
  e.preventDefault()
}

let touchX: number | null = null

function onTouchStart(e: TouchEvent) {
  touchX = e.touches.length === 1 && !zoomed.value ? e.touches[0]!.clientX : null
}

function onTouchEnd(e: TouchEvent) {
  if (touchX === null) return
  const dx = e.changedTouches[0]!.clientX - touchX
  touchX = null
  if (Math.abs(dx) > 60) go(dx < 0 ? 1 : -1)
}

const body = ref<HTMLElement | null>(null)
const strip = ref<HTMLElement | null>(null)
/** Where focus was before the viewer opened, to give it back. */
let returnFocus: HTMLElement | null = null

watch(index, async () => {
  await nextTick()
  strip.value?.querySelector('[aria-current="true"]')?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
})

onMounted(() => {
  returnFocus = document.activeElement as HTMLElement | null
  window.addEventListener('keydown', onKeydown)
  // Into the modal, on its first button, so the keys and Tab start there.
  body.value?.closest('[role="dialog"]')?.querySelector<HTMLElement>('button')?.focus()
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown)
  for (const item of Object.values(loaded.value)) if (item.url) URL.revokeObjectURL(item.url)
  returnFocus?.focus?.()
})

// --- what's shown about the file -------------------------------------------------

/** Its size, and who uploaded it and when where that's known. */
function about(a: ViewerFile): string {
  const parts = [formatSize(a.size_bytes)]
  if (a.uploaded_by) parts.push(a.uploaded_by.id === auth.user?.id ? t('common.you_capital') : a.uploaded_by.name || a.uploaded_by.email)
  if (a.created_at) parts.push(formatDate(a.created_at))
  return parts.join(' · ')
}

// --- review and pins ---------------------------------------------------------------

const reviewing = ref(false)

/** Picking the review the file has takes it back. */
async function setReview(review: FileReview) {
  const a = current.value
  if (!a || !props.review || reviewing.value) return
  reviewing.value = true
  try {
    await props.review.setReview(a, a.review === review ? null : review)
  } finally {
    reviewing.value = false
  }
}

/** "Approved · Acme", or just what was said when who said it isn't known. */
function reviewLabel(a: ViewerFile): string {
  const approved = a.review === 'approved'
  const r = a.reviewed_by
  if (!r) return approved ? t('fileReview.approvedShort') : t('fileReview.changesShort')
  const name = r.id === auth.user?.id ? t('common.you_capital') : r.name || r.email
  return approved ? t('fileReview.approvedBy', { name }) : t('fileReview.changesBy', { name })
}

/** The image's pinned comments, numbered in the order they were written. */
const pins = computed(() => (current.value && props.review ? (props.review.pins[current.value.id] ?? []) : []))
const canPin = computed(() => !!props.review?.canPin && kind.value === 'image')
const draftText = ref('')
const savingPin = ref(false)

function onImageClick(e: MouseEvent) {
  if (!pinning.value) {
    zoomed.value = !zoomed.value
    return
  }
  const box = (e.currentTarget as HTMLElement).getBoundingClientRect()
  if (!box.width || !box.height) return
  const clamp = (v: number) => Math.min(1, Math.max(0, v))
  draftPin.value = { x: clamp((e.clientX - box.left) / box.width), y: clamp((e.clientY - box.top) / box.height) }
  activePin.value = null
  void nextTick(() => body.value?.querySelector<HTMLTextAreaElement>('#pin-comment')?.focus())
}

function cancelPin() {
  draftPin.value = null
  draftText.value = ''
}

async function savePin() {
  const a = current.value
  const spot = draftPin.value
  const text = draftText.value.trim()
  if (!a || !spot || !text || !props.review) return
  savingPin.value = true
  try {
    await props.review.addPin(a, spot.x, spot.y, text)
    cancelPin()
    pinning.value = false
  } catch {
    toast.error(t('fileReview.pinFailed'))
  } finally {
    savingPin.value = false
  }
}

function pinAuthor(c: Comment): string {
  return c.author.id === auth.user?.id ? t('common.you_capital') : c.author.name || c.author.email
}

async function download(a: ViewerFile) {
  try {
    await (props.source ? props.source.download(a) : downloadAttachment(a as Attachment))
  } catch {
    toast.error(t('attachments.downloadFailed', { name: a.file_name }))
  }
}
</script>

<template>
  <Modal v-if="current" :title="current.file_name" size="xl" @close="emit('close')">
    <template #actions>
      <span v-if="many" class="mr-1 text-xs text-neutral-400 tabular-nums">{{ $t('attachments.counter', { n: index + 1, total: files.length }) }}</span>
      <button
        type="button"
        class="inline-flex rounded-md p-1 text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-900"
        :aria-label="$t('attachments.downloadNamed', { name: current.file_name })"
        :title="$t('attachments.download')"
        @click="download(current)"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-4 w-4" aria-hidden="true">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="7 10 12 15 17 10" />
          <line x1="12" y1="15" x2="12" y2="3" />
        </svg>
      </button>
    </template>

    <div ref="body" @touchstart.passive="onTouchStart" @touchend="onTouchEnd">
      <div class="flex flex-wrap items-center gap-x-2 gap-y-1">
        <p class="min-w-0 truncate text-xs text-neutral-500">{{ about(current) }}</p>
        <span
          v-if="current.review"
          class="rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset"
          :class="current.review === 'approved' ? 'bg-emerald-50 text-emerald-700 ring-emerald-600/20' : 'bg-amber-50 text-amber-700 ring-amber-600/20'"
        >
          {{ reviewLabel(current) }}
        </span>
      </div>

      <!-- the file's versions, the latest last -->
      <div v-if="versions.length > 1" class="mt-2 flex flex-wrap items-center gap-1" role="group" :aria-label="$t('fileReview.versions')">
        <button
          v-for="v in versions"
          :key="v.id"
          type="button"
          class="rounded-md px-2 py-0.5 text-xs font-medium tabular-nums transition-colors"
          :class="v.id === current.id ? 'bg-neutral-900 text-white' : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'"
          :aria-pressed="v.id === current.id"
          :title="v.file_name"
          @click="pickedVersion = v.id === open?.id ? null : v.id"
        >
          {{ $t('fileReview.version', { n: v.version }) }}
        </button>
      </div>

      <!-- the file itself -->
      <div class="relative mt-3 flex h-[min(60vh,40rem)] items-center justify-center overflow-hidden rounded-lg bg-neutral-100">
        <span v-if="loading" class="h-6 w-6 animate-spin rounded-full border-2 border-neutral-300 border-t-neutral-700" role="status" :aria-label="$t('common.loading')" />

        <div v-else-if="!kind || failed" class="flex flex-col items-center px-6 text-center">
          <span class="flex h-16 w-13 items-center justify-center rounded-lg bg-white text-xs font-semibold tracking-wide text-neutral-500 shadow-sm ring-1 ring-neutral-200">
            {{ fileExtension(current.file_name) }}
          </span>
          <p class="mt-4 text-sm font-medium text-neutral-900">{{ failed ? $t('attachments.previewFailed') : $t('attachments.noPreview') }}</p>
          <button
            type="button"
            class="mt-4 inline-flex h-9 items-center rounded-lg bg-neutral-900 px-4 text-sm font-medium text-white shadow-xs transition-colors hover:bg-neutral-800"
            @click="download(current)"
          >
            {{ $t('attachments.download') }} · {{ formatSize(current.size_bytes) }}
          </button>
        </div>

        <template v-else-if="shown">
          <div v-if="kind === 'image'" class="flex h-full w-full" :class="zoomed ? 'overflow-auto' : 'items-center justify-center p-3'">
            <!-- the pins sit over the picture, placed in fractions of it -->
            <div class="relative" :class="zoomed ? 'm-auto' : 'max-h-full max-w-full'">
              <img
                :src="shown.url"
                :alt="current.file_name"
                class="block select-none"
                :class="[
                  zoomed ? 'max-w-none' : 'max-h-[calc(min(60vh,40rem)-1.5rem)] max-w-full rounded object-contain',
                  pinning ? 'cursor-crosshair' : zoomed ? 'cursor-zoom-out' : 'cursor-zoom-in',
                ]"
                :title="pinning ? $t('fileReview.clickToPin') : zoomed ? $t('attachments.zoomOut') : $t('attachments.zoomIn')"
                @click="onImageClick"
              />
              <button
                v-for="(c, i) in pins"
                :key="c.id"
                type="button"
                class="absolute flex h-6 w-6 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full text-[11px] font-semibold text-white shadow ring-2 ring-white transition-transform hover:scale-110"
                :class="activePin === c.id ? 'scale-110 bg-neutral-900' : 'bg-rose-600'"
                :style="{ left: `${c.pin!.x * 100}%`, top: `${c.pin!.y * 100}%` }"
                :aria-label="$t('fileReview.pin', { n: i + 1 })"
                @click.stop="activePin = activePin === c.id ? null : c.id"
              >
                {{ i + 1 }}
              </button>
              <span
                v-if="draftPin"
                class="pointer-events-none absolute flex h-6 w-6 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-neutral-900 text-[11px] font-semibold text-white shadow ring-2 ring-white"
                :style="{ left: `${draftPin.x * 100}%`, top: `${draftPin.y * 100}%` }"
                aria-hidden="true"
              >
                {{ pins.length + 1 }}
              </span>
            </div>
          </div>
          <iframe v-else-if="kind === 'pdf'" :src="shown.url" :title="current.file_name" class="h-full w-full bg-white" />
          <video v-else-if="kind === 'video'" :src="shown.url" controls class="max-h-full max-w-full" />
          <audio v-else-if="kind === 'audio'" :src="shown.url" controls class="w-full max-w-md px-6" />
          <div v-else-if="kind === 'text'" class="flex h-full w-full flex-col bg-white">
            <pre class="min-h-0 flex-1 overflow-auto p-4 font-mono text-xs leading-relaxed break-words whitespace-pre-wrap text-neutral-800">{{ shown.text }}</pre>
            <p v-if="shown.truncated" class="shrink-0 border-t border-neutral-200 px-4 py-2 text-xs text-neutral-500">
              {{ $t('attachments.truncated', { size: formatSize(TEXT_LIMIT) }) }}
            </p>
          </div>
        </template>

        <template v-if="many">
          <button
            type="button"
            class="absolute top-1/2 left-2 -translate-y-1/2 rounded-full bg-white/90 p-2 text-neutral-600 shadow-sm ring-1 ring-neutral-200 transition-colors hover:bg-white hover:text-neutral-900"
            :aria-label="$t('attachments.previous')"
            :title="$t('attachments.previous')"
            @click="go(-1)"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-4 w-4" aria-hidden="true"><polyline points="15 18 9 12 15 6" /></svg>
          </button>
          <button
            type="button"
            class="absolute top-1/2 right-2 -translate-y-1/2 rounded-full bg-white/90 p-2 text-neutral-600 shadow-sm ring-1 ring-neutral-200 transition-colors hover:bg-white hover:text-neutral-900"
            :aria-label="$t('attachments.next')"
            :title="$t('attachments.next')"
            @click="go(1)"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-4 w-4" aria-hidden="true"><polyline points="9 18 15 12 9 6" /></svg>
          </button>
        </template>
      </div>

      <!-- what the client's side thinks of it, and comments on spots of an image -->
      <div v-if="current.can_review || canPin" class="mt-3 flex flex-wrap items-center gap-2">
        <div v-if="current.can_review" class="grid grid-flow-col [grid-auto-columns:1fr] gap-2">
          <button
            type="button"
            class="inline-flex h-8 items-center justify-center gap-1.5 rounded-lg px-3 text-sm font-medium ring-1 transition-colors ring-inset disabled:opacity-60"
            :class="current.review === 'approved' ? 'bg-emerald-600 text-white ring-emerald-600' : 'bg-white text-neutral-700 ring-neutral-300 hover:bg-neutral-50'"
            :aria-pressed="current.review === 'approved'"
            :disabled="reviewing"
            @click="setReview('approved')"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-4 w-4" aria-hidden="true"><polyline points="20 6 9 17 4 12" /></svg>
            {{ $t('fileReview.approve') }}
          </button>
          <button
            type="button"
            class="inline-flex h-8 items-center justify-center gap-1.5 rounded-lg px-3 text-sm font-medium ring-1 transition-colors ring-inset disabled:opacity-60"
            :class="current.review === 'changes_requested' ? 'bg-amber-500 text-white ring-amber-500' : 'bg-white text-neutral-700 ring-neutral-300 hover:bg-neutral-50'"
            :aria-pressed="current.review === 'changes_requested'"
            :disabled="reviewing"
            @click="setReview('changes_requested')"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-4 w-4" aria-hidden="true"><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg>
            {{ $t('fileReview.requestChanges') }}
          </button>
        </div>
        <button
          v-if="canPin"
          type="button"
          class="ml-auto inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-sm font-medium ring-1 transition-colors ring-inset"
          :class="pinning ? 'bg-neutral-900 text-white ring-neutral-900' : 'bg-white text-neutral-700 ring-neutral-300 hover:bg-neutral-50'"
          :aria-pressed="pinning"
          @click="pinning = !pinning; cancelPin()"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-4 w-4" aria-hidden="true">
            <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
            <circle cx="12" cy="10" r="3" />
          </svg>
          {{ pinning ? $t('fileReview.pinning') : $t('fileReview.addPin') }}
        </button>
      </div>

      <form v-if="draftPin" class="mt-3 space-y-2" @submit.prevent="savePin">
        <label for="pin-comment" class="text-xs font-medium text-neutral-600">{{ $t('fileReview.pinComment', { n: pins.length + 1 }) }}</label>
        <textarea
          id="pin-comment"
          v-model="draftText"
          rows="2"
          class="block w-full resize-y rounded-md border border-neutral-200 bg-white px-2 py-1.5 text-sm leading-relaxed text-neutral-800 focus:border-neutral-900 focus:ring-2 focus:ring-neutral-900/10 focus:outline-none"
          @keydown.enter.meta.prevent="savePin"
          @keydown.enter.ctrl.prevent="savePin"
          @keydown.esc.stop="cancelPin"
        />
        <div class="ml-auto grid grid-flow-col [grid-auto-columns:1fr] gap-2 w-fit">
          <button type="button" class="h-8 rounded-lg px-3 text-sm font-medium text-neutral-600 hover:bg-neutral-100" @click="cancelPin">{{ $t('common.cancel') }}</button>
          <button
            type="submit"
            class="h-8 rounded-lg bg-neutral-900 px-3 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-50"
            :disabled="!draftText.trim() || savingPin"
          >
            {{ $t('fileReview.savePin') }}
          </button>
        </div>
      </form>

      <!-- the image's pinned comments -->
      <ol v-if="pins.length" class="mt-3 max-h-40 space-y-1.5 overflow-y-auto">
        <li
          v-for="(c, i) in pins"
          :key="c.id"
          class="flex gap-2 rounded-lg px-2 py-1.5 text-sm transition-colors"
          :class="activePin === c.id ? 'bg-neutral-100' : ''"
          @mouseenter="activePin = c.id"
          @mouseleave="activePin = null"
        >
          <span class="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-rose-600 text-[10px] font-semibold text-white">{{ i + 1 }}</span>
          <div class="min-w-0">
            <p class="text-xs text-neutral-500">
              <span class="font-medium text-neutral-800">{{ pinAuthor(c) }}</span>
              <time class="ml-1 text-neutral-400" :datetime="c.created_at">{{ timeAgo(c.created_at) }}</time>
            </p>
            <div class="comment-body text-sm leading-relaxed break-words text-neutral-800" v-html="renderComment(c.body, auth.user?.id)" />
          </div>
        </li>
      </ol>

      <!-- every file of the task, to jump to one -->
      <nav v-if="many" ref="strip" class="mt-3 flex justify-center-safe gap-2 overflow-x-auto p-0.5" :aria-label="$t('attachments.files')">
        <button
          v-for="(a, i) in files"
          :key="a.id"
          type="button"
          class="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-md bg-neutral-100 text-[10px] font-semibold tracking-wide text-neutral-500 ring-2 transition"
          :class="i === index ? 'ring-neutral-900' : 'opacity-70 ring-transparent hover:opacity-100'"
          :aria-label="a.file_name"
          :title="a.file_name"
          :aria-current="i === index ? 'true' : undefined"
          @click="index = i"
        >
          <img v-if="previews[a.id]" :src="previews[a.id]" alt="" class="h-full w-full object-cover" />
          <template v-else>{{ fileExtension(a.file_name) }}</template>
        </button>
      </nav>
    </div>
  </Modal>
</template>
