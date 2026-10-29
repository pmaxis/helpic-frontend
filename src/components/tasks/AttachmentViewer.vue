<script setup lang="ts">
/**
 * A task's files one at a time, in a modal: images, PDFs, videos, sound and
 * text shown in place, anything else with a way to download it. The arrows
 * (keys, buttons, a swipe) or the strip under the file go through the task's
 * files; Escape or a click outside closes it, as any modal.
 *
 * The files come from the signed-in API, or from wherever source says — a
 * task's public link; who uploaded a file and when are shown when known.
 */
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import Modal from '@/components/ui/Modal.vue'
import { useAuthStore } from '@/stores/auth'
import { attachmentBlob, downloadAttachment, fileExtension, formatSize, previewKind } from '@/services/attachments'
import { formatDate } from '@/utils/format'
import { toast } from '@/composables/useToasts'
import { t } from '@/i18n'
import type { Attachment } from '@/types/attachments'

/** A file the viewer shows: an attachment, or less of one. */
export type ViewerFile = Pick<Attachment, 'id' | 'file_name' | 'content_type' | 'size_bytes' | 'is_image'> &
  Partial<Pick<Attachment, 'uploaded_by' | 'created_at'>>

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
}>()

const index = defineModel<number>('index', { required: true })
const emit = defineEmits<{ close: [] }>()

const auth = useAuthStore()

/** Text is shown up to this much; the rest is left to the download. */
const TEXT_LIMIT = 512 * 1024

const current = computed<ViewerFile | undefined>(() => props.files[index.value])
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

watch(
  current,
  (a) => {
    zoomed.value = false
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
      <p class="truncate text-xs text-neutral-500">{{ about(current) }}</p>

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
            <img
              :src="shown.url"
              :alt="current.file_name"
              class="select-none"
              :class="zoomed ? 'm-auto max-w-none cursor-zoom-out' : 'max-h-full max-w-full cursor-zoom-in rounded object-contain'"
              :title="zoomed ? $t('attachments.zoomOut') : $t('attachments.zoomIn')"
              @click="zoomed = !zoomed"
            />
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
