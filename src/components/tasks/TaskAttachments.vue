<script setup lang="ts">
/**
 * A task's files — mockups, specs, results. Both sides add them (button or
 * drag and drop onto the section) and download them; images get a preview.
 * Only the uploader deletes a file.
 */
import { onBeforeUnmount, ref, watch } from 'vue'
import ConfirmDialog from '@/components/ui/ConfirmDialog.vue'
import { useAuthStore } from '@/stores/auth'
import { ApiRequestError } from '@/services/api'
import { attachmentURL, deleteAttachment, downloadAttachment, formatSize, listAttachments, uploadAttachment } from '@/services/attachments'
import { formatDate } from '@/utils/format'
import { toast } from '@/composables/useToasts'
import { t } from '@/i18n'
import type { Attachment } from '@/types/attachments'

const props = defineProps<{
  taskId: string
  /** An archived task's files: looked at and downloaded, never added or removed. */
  readonly?: boolean
}>()

const auth = useAuthStore()

const files = ref<Attachment[]>([])
const maxSize = ref(25 * 1024 * 1024)
const loaded = ref(false)

/** Uploads in flight, shown under the list with their progress. */
interface Upload {
  key: number
  name: string
  progress: number
}
const uploads = ref<Upload[]>([])
let uploadKey = 0

/** Image previews as object URLs, by attachment id. */
const previews = ref<Record<string, string>>({})

function revokePreviews() {
  for (const url of Object.values(previews.value)) URL.revokeObjectURL(url)
  previews.value = {}
}

async function loadPreview(a: Attachment) {
  if (!a.is_image || previews.value[a.id]) return
  try {
    const url = await attachmentURL(a.id, true)
    previews.value = { ...previews.value, [a.id]: url }
  } catch {
    // No preview; the file still downloads.
  }
}

async function load(taskId: string) {
  loaded.value = false
  files.value = []
  revokePreviews()
  try {
    const data = await listAttachments(taskId)
    if (taskId !== props.taskId) return
    files.value = data.attachments
    maxSize.value = data.maxSize
    files.value.forEach((a) => void loadPreview(a))
  } catch {
    toast.error(t('attachments.loadFailed'))
  } finally {
    loaded.value = true
  }
}

watch(
  () => props.taskId,
  (id) => void load(id),
  { immediate: true },
)
onBeforeUnmount(revokePreviews)

// --- adding files -------------------------------------------------------------

const input = ref<HTMLInputElement | null>(null)

function add(list: FileList | File[]) {
  for (const file of Array.from(list)) {
    if (file.size > maxSize.value) {
      toast.error(t('attachments.tooLarge', { name: file.name, size: formatSize(maxSize.value) }))
      continue
    }
    void send(file)
  }
}

async function send(file: File) {
  const taskId = props.taskId
  const item: Upload = { key: ++uploadKey, name: file.name, progress: 0 }
  uploads.value = [...uploads.value, item]
  try {
    const a = await uploadAttachment(taskId, file, (share) => {
      uploads.value = uploads.value.map((u) => (u.key === item.key ? { ...u, progress: share } : u))
    })
    if (taskId === props.taskId) {
      files.value = [...files.value, a]
      void loadPreview(a)
    }
  } catch (error) {
    toast.error(
      error instanceof ApiRequestError
        ? t('attachments.failedWith', { name: file.name, message: error.message })
        : t('attachments.uploadFailed', { name: file.name }),
    )
  } finally {
    uploads.value = uploads.value.filter((u) => u.key !== item.key)
  }
}

function onPick(e: Event) {
  const el = e.target as HTMLInputElement
  if (el.files) add(el.files)
  el.value = ''
}

// Drag and drop onto the section. A counter, since dragleave fires on children.
const dragDepth = ref(0)

function hasFiles(e: DragEvent): boolean {
  return !props.readonly && !!e.dataTransfer && Array.from(e.dataTransfer.types).includes('Files')
}

function onDragEnter(e: DragEvent) {
  if (!hasFiles(e)) return
  e.preventDefault()
  dragDepth.value++
}

function onDragOver(e: DragEvent) {
  if (!hasFiles(e)) return
  e.preventDefault()
  if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy'
}

function onDragLeave(e: DragEvent) {
  if (!hasFiles(e)) return
  dragDepth.value = Math.max(0, dragDepth.value - 1)
}

function onDrop(e: DragEvent) {
  if (!hasFiles(e)) return
  e.preventDefault()
  dragDepth.value = 0
  if (e.dataTransfer?.files.length) add(e.dataTransfer.files)
}

// --- opening and deleting -------------------------------------------------------

/** Images open in a new tab; other files download. */
async function open(a: Attachment) {
  try {
    const preview = previews.value[a.id]
    if (preview) window.open(preview, '_blank', 'noopener')
    else await downloadAttachment(a)
  } catch {
    toast.error(t('attachments.downloadFailed', { name: a.file_name }))
  }
}

const removing = ref<Attachment | null>(null)
const removeBusy = ref(false)

async function remove() {
  const a = removing.value
  if (!a) return
  removeBusy.value = true
  try {
    await deleteAttachment(a.id)
    files.value = files.value.filter((f) => f.id !== a.id)
    const url = previews.value[a.id]
    if (url) URL.revokeObjectURL(url)
  } catch (error) {
    toast.error(error instanceof ApiRequestError ? error.message : t('attachments.deleteFailed'))
  } finally {
    removeBusy.value = false
    removing.value = null
  }
}

/** "PDF", "DOCX" — shown instead of a preview. */
function extension(name: string): string {
  const i = name.lastIndexOf('.')
  return i > 0 && name.length - i <= 6 ? name.slice(i + 1).toUpperCase() : 'FILE'
}

function uploader(a: Attachment): string {
  return a.uploaded_by.id === auth.user?.id ? t('common.you_capital') : a.uploaded_by.name || a.uploaded_by.email
}
</script>

<template>
  <section
    aria-labelledby="task-attachments"
    class="relative mt-8 min-w-0"
    @dragenter="onDragEnter"
    @dragover="onDragOver"
    @dragleave="onDragLeave"
    @drop="onDrop"
  >
    <div class="flex items-center justify-between gap-2">
      <h2 id="task-attachments" class="text-xs font-semibold tracking-wide text-neutral-500 uppercase">
        {{ $t('attachments.title') }}<span v-if="files.length" class="ml-1.5 font-normal text-neutral-400">{{ files.length }}</span>
      </h2>
      <button
        v-if="!readonly"
        type="button"
        class="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-medium text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-900"
        @click="input?.click()"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-3.5 w-3.5" aria-hidden="true">
          <path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48" />
        </svg>
        {{ $t('attachments.add') }}
      </button>
      <input ref="input" type="file" multiple class="hidden" @change="onPick" />
    </div>

    <ul v-if="files.length || uploads.length" class="mt-3 grid gap-2 sm:grid-cols-2">
      <li v-for="a in files" :key="a.id" class="group flex min-w-0 items-center gap-3 rounded-lg border border-neutral-200 bg-white p-2 pr-1.5">
        <button
          type="button"
          class="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-md bg-neutral-100 text-[10px] font-semibold tracking-wide text-neutral-500"
          :title="a.is_image ? $t('attachments.open') : $t('attachments.download')"
          :aria-label="`${a.is_image ? $t('attachments.open') : $t('attachments.download')} ${a.file_name}`"
          @click="open(a)"
        >
          <img v-if="previews[a.id]" :src="previews[a.id]" alt="" class="h-full w-full object-cover" />
          <template v-else>{{ extension(a.file_name) }}</template>
        </button>
        <div class="min-w-0 flex-1">
          <button
            type="button"
            class="block max-w-full truncate text-left text-sm font-medium text-neutral-800 underline-offset-4 hover:text-neutral-950 hover:underline"
            :title="a.file_name"
            @click="open(a)"
          >
            {{ a.file_name }}
          </button>
          <p class="truncate text-xs text-neutral-400">{{ formatSize(a.size_bytes) }} · {{ uploader(a) }} · {{ formatDate(a.created_at) }}</p>
        </div>
        <button
          type="button"
          class="shrink-0 rounded-md p-1 text-neutral-400 transition hover:bg-neutral-100 hover:text-neutral-900"
          :aria-label="$t('attachments.downloadNamed', { name: a.file_name })"
          :title="$t('attachments.download')"
          @click="downloadAttachment(a).catch(() => toast.error(t('attachments.downloadFailed', { name: a.file_name })))"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-4 w-4" aria-hidden="true">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
        </button>
        <button
          v-if="a.can_delete && !readonly"
          type="button"
          class="shrink-0 rounded-md p-1 text-neutral-400 transition hover:bg-red-50 hover:text-red-600"
          :aria-label="$t('attachments.deleteNamed', { name: a.file_name })"
          :title="$t('attachments.delete')"
          @click="removing = a"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-4 w-4" aria-hidden="true">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </li>

      <li v-for="u in uploads" :key="`up-${u.key}`" class="flex min-w-0 items-center gap-3 rounded-lg border border-dashed border-neutral-300 bg-white p-2">
        <span class="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-neutral-50" aria-hidden="true">
          <span class="h-4 w-4 animate-spin rounded-full border-2 border-neutral-300 border-t-neutral-700" />
        </span>
        <div class="min-w-0 flex-1">
          <p class="truncate text-sm text-neutral-700">{{ u.name }}</p>
          <div class="mt-1.5 h-1 overflow-hidden rounded-full bg-neutral-100" role="progressbar" :aria-valuenow="Math.round(u.progress * 100)" aria-valuemin="0" aria-valuemax="100" :aria-label="$t('attachments.uploading', { name: u.name })">
            <div class="h-full rounded-full bg-neutral-900 transition-[width]" :style="{ width: `${Math.round(u.progress * 100)}%` }" />
          </div>
        </div>
      </li>
    </ul>

    <p v-else-if="loaded && readonly" class="mt-3 text-sm text-neutral-400">{{ $t('attachments.none') }}</p>
    <button
      v-else-if="loaded"
      type="button"
      class="mt-3 w-full rounded-xl border border-dashed border-neutral-300 px-4 py-5 text-center text-sm text-neutral-400 transition-colors hover:border-neutral-400 hover:text-neutral-600"
      @click="input?.click()"
    >
      {{ $t('attachments.drop') }}
      <span class="mt-0.5 block text-xs">{{ $t('attachments.limit', { size: formatSize(maxSize) }) }}</span>
    </button>

    <!-- shown while files are dragged over the section -->
    <div
      v-if="dragDepth > 0"
      class="pointer-events-none absolute -inset-2 flex items-center justify-center rounded-xl border-2 border-dashed border-neutral-900 bg-white/90 text-sm font-medium text-neutral-900"
      aria-hidden="true"
    >
      {{ $t('attachments.dropToAttach') }}
    </div>

    <ConfirmDialog
      :open="!!removing"
      :title="$t('attachments.confirmDelete')"
      :description="removing ? $t('attachments.confirmDeleteText', { name: removing.file_name }) : ''"
      :loading="removeBusy"
      @update:open="(v: boolean) => { if (!v) removing = null }"
      @confirm="remove"
    />
  </section>
</template>
