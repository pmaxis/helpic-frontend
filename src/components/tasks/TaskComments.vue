<script setup lang="ts">
/**
 * The discussion on a task: its freelancer and client write here instead of
 * rewriting the description. Oldest first, the box to write at the bottom;
 * ⌘/Ctrl + Enter sends. Authors edit and delete their own comments.
 */
import { computed, nextTick, ref, watch } from 'vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import ConfirmDialog from '@/components/ui/ConfirmDialog.vue'
import { useAuthStore } from '@/stores/auth'
import { ApiRequestError } from '@/services/api'
import { createComment, deleteComment, listComments, updateComment } from '@/services/comments'
import { formatDate, timeAgo } from '@/utils/format'
import { toast } from '@/composables/useToasts'
import { t } from '@/i18n'
import type { Comment } from '@/types/comments'

const props = defineProps<{ taskId: string }>()
const emit = defineEmits<{ count: [n: number] }>()

const auth = useAuthStore()

const comments = ref<Comment[]>([])
const loaded = ref(false)

async function load(taskId: string) {
  loaded.value = false
  comments.value = []
  try {
    const list = await listComments(taskId)
    if (taskId === props.taskId) comments.value = list
  } catch {
    toast.error(t('comments.loadFailed'))
  } finally {
    loaded.value = true
  }
}

watch(
  () => props.taskId,
  (id) => void load(id),
  { immediate: true },
)
watch(
  () => comments.value.length,
  (n) => emit('count', n),
  { immediate: true },
)

function initials(name: string): string {
  const words = name.split(/\s+/).filter(Boolean)
  return (words.length > 1 ? words[0][0] + words[1][0] : name.slice(0, 2)).toUpperCase()
}

function authorName(c: Comment): string {
  return c.author.id === auth.user?.id ? t('common.you_capital') : c.author.name || c.author.email
}

/** Grows a textarea with its text, up to its max-height. */
function grow(el: HTMLTextAreaElement | null) {
  if (!el) return
  el.style.height = 'auto'
  el.style.height = `${el.scrollHeight}px`
}

function errorMessage(error: unknown, fallback: string): string {
  if (!(error instanceof ApiRequestError)) return fallback
  return Object.values(error.fields ?? {})[0] ?? error.message
}

// --- writing ---------------------------------------------------------------------

const draft = ref('')
const sending = ref(false)
const composer = ref<HTMLTextAreaElement | null>(null)
const canSend = computed(() => !!draft.value.trim() && !sending.value)

async function send() {
  if (!canSend.value) return
  const taskId = props.taskId
  sending.value = true
  try {
    const c = await createComment(taskId, draft.value)
    if (taskId === props.taskId) comments.value = [...comments.value, c]
    draft.value = ''
    await nextTick()
    grow(composer.value)
  } catch (error) {
    toast.error(errorMessage(error, t('comments.postFailed')))
  } finally {
    sending.value = false
  }
}

// --- editing and deleting your own --------------------------------------------------

const editingId = ref<string | null>(null)
const editDraft = ref('')
const savingEdit = ref(false)

async function startEdit(c: Comment) {
  editingId.value = c.id
  editDraft.value = c.body
  await nextTick()
  const el = document.getElementById(`comment-edit-${c.id}`) as HTMLTextAreaElement | null
  grow(el)
  el?.focus()
  el?.setSelectionRange(el.value.length, el.value.length)
}

async function saveEdit() {
  const id = editingId.value
  const c = comments.value.find((x) => x.id === id)
  if (!id || !c || savingEdit.value) return
  if (editDraft.value.trim() === c.body) {
    editingId.value = null
    return
  }
  savingEdit.value = true
  try {
    const updated = await updateComment(id, editDraft.value)
    comments.value = comments.value.map((x) => (x.id === id ? updated : x))
    editingId.value = null
  } catch (error) {
    toast.error(errorMessage(error, t('comments.saveFailed')))
  } finally {
    savingEdit.value = false
  }
}

const removing = ref<Comment | null>(null)
const removeBusy = ref(false)

async function remove() {
  const c = removing.value
  if (!c) return
  removeBusy.value = true
  try {
    await deleteComment(c.id)
    comments.value = comments.value.filter((x) => x.id !== c.id)
  } catch (error) {
    toast.error(errorMessage(error, t('comments.deleteFailed')))
  } finally {
    removeBusy.value = false
    removing.value = null
  }
}
</script>

<template>
  <div class="min-w-0">

    <ol v-if="comments.length" class="mt-3 space-y-4">
      <li v-for="c in comments" :key="c.id" class="group flex gap-3">
        <span
          class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold"
          :class="c.author.id === auth.user?.id ? 'bg-neutral-900 text-white' : 'bg-neutral-100 text-neutral-600'"
          aria-hidden="true"
        >
          {{ initials(c.author.name || c.author.email) }}
        </span>
        <div class="min-w-0 flex-1">
          <div class="flex flex-wrap items-baseline gap-x-2">
            <span class="text-sm font-medium text-neutral-900">{{ authorName(c) }}</span>
            <time class="text-xs text-neutral-400" :datetime="c.created_at" :title="formatDate(c.created_at)">{{ timeAgo(c.created_at) }}</time>
            <span v-if="c.edited" class="text-xs text-neutral-400" :title="$t('comments.editedOn', { date: formatDate(c.updated_at) })">· {{ $t('comments.edited') }}</span>
            <span v-if="c.can_edit && editingId !== c.id" class="ml-auto flex gap-1 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100 [@media(hover:none)]:opacity-100">
              <button type="button" class="rounded px-1 text-xs text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900" @click="startEdit(c)">{{ $t('common.edit') }}</button>
              <button type="button" class="rounded px-1 text-xs text-neutral-500 hover:bg-red-50 hover:text-red-600" @click="removing = c">{{ $t('common.delete') }}</button>
            </span>
          </div>

          <div v-if="editingId === c.id" class="mt-1.5">
            <label :for="`comment-edit-${c.id}`" class="sr-only">{{ $t('comments.editYours') }}</label>
            <textarea
              :id="`comment-edit-${c.id}`"
              v-model="editDraft"
              rows="2"
              maxlength="10000"
              :disabled="savingEdit"
              class="block max-h-72 w-full resize-none rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm leading-relaxed text-neutral-900 focus:border-neutral-900 focus:ring-2 focus:ring-neutral-900/10 focus:outline-none"
              @input="grow($event.target as HTMLTextAreaElement)"
              @keydown.esc.prevent="editingId = null"
              @keydown.meta.enter.prevent="saveEdit"
              @keydown.ctrl.enter.prevent="saveEdit"
            />
            <div class="mt-1.5 flex items-center gap-2">
              <BaseButton size="sm" :block="false" :loading="savingEdit" :disabled="!editDraft.trim()" @click="saveEdit">{{ $t('common.save') }}</BaseButton>
              <BaseButton variant="ghost" size="sm" :block="false" :disabled="savingEdit" @click="editingId = null">{{ $t('common.cancel') }}</BaseButton>
            </div>
          </div>
          <p v-else class="mt-0.5 text-sm leading-relaxed whitespace-pre-wrap break-words text-neutral-800">{{ c.body }}</p>
        </div>
      </li>
    </ol>
    <p v-else-if="loaded" class="mt-3 text-sm text-neutral-400">{{ $t('comments.empty') }}</p>

    <!-- write -->
    <form class="mt-4 flex gap-3" novalidate @submit.prevent="send">
      <span
        class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-neutral-900 text-[11px] font-semibold text-white"
        aria-hidden="true"
      >
        {{ initials(auth.user?.name || auth.user?.email || '?') }}
      </span>
      <div class="min-w-0 flex-1 rounded-lg border border-neutral-300 bg-white focus-within:border-neutral-900 focus-within:ring-2 focus-within:ring-neutral-900/10">
        <label for="comment-new" class="sr-only">{{ $t('comments.write') }}</label>
        <textarea
          id="comment-new"
          ref="composer"
          v-model="draft"
          rows="1"
          maxlength="10000"
          :placeholder="$t('comments.placeholder')"
          class="block max-h-72 w-full resize-none rounded-lg bg-transparent px-3 py-2 text-sm leading-relaxed text-neutral-900 placeholder:text-neutral-400 focus:outline-none"
          @input="grow($event.target as HTMLTextAreaElement)"
          @keydown.meta.enter.prevent="send"
          @keydown.ctrl.enter.prevent="send"
        />
        <div v-if="draft" class="flex items-center justify-end gap-2 px-2 pb-2">
          <span class="text-xs text-neutral-400">{{ $t('comments.shortcut') }}</span>
          <BaseButton type="submit" size="sm" :block="false" :loading="sending" :disabled="!canSend">{{ $t('comments.send') }}</BaseButton>
        </div>
      </div>
    </form>

    <ConfirmDialog
      :open="!!removing"
      :title="$t('comments.confirmDelete')"
      :description="$t('comments.confirmDeleteText')"
      :loading="removeBusy"
      @update:open="(v: boolean) => { if (!v) removing = null }"
      @confirm="remove"
    />
  </div>
</template>
