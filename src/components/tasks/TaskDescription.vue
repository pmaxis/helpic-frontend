<script setup lang="ts">
/**
 * The task's description, as formatted text; whoever may edit the task
 * clicks it to change it in place, in a WYSIWYG editor. It's kept as Markdown.
 * A long one is folded to its first lines, fading out, until it's asked for
 * in full, so the subtasks, files and talk under it stay in sight.
 */
import { computed, defineAsyncComponent, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import BaseButton from '@/components/ui/BaseButton.vue'
// The editor is big: it loads apart, as soon as the description may be edited.
const loadEditor = () => import('@/components/ui/RichTextEditor.vue')
const RichTextEditor = defineAsyncComponent(loadEditor)
import { renderRichText } from '@/utils/richText'
import type { Task, TaskInput } from '@/types/tasks'

const props = defineProps<{
  task: Task
  saving: boolean
  /** Saves one change to the task; false when it was refused. */
  save: (change: Partial<TaskInput>) => Promise<boolean>
}>()

const MAX_LENGTH = 20000
/** The height a long description folds to, in px: about twelve lines. */
const FOLDED = 288
/** It folds only when that hides more than a few lines, not to hide one line behind a button. */
const FOLD_AFTER = FOLDED + 96

const editing = ref(false)
const draft = ref('')
const html = computed(() => renderRichText(props.task.description))
const tooLong = computed(() => draft.value.length > MAX_LENGTH)

// --- folding --------------------------------------------------------------------

const body = ref<HTMLElement | null>(null)
const long = ref(false)
const expanded = ref(false)
let observer: ResizeObserver | undefined

function measure() {
  long.value = (body.value?.scrollHeight ?? 0) > FOLD_AFTER
}

/** Watches the shown description's height; it changes with the text and the width. */
async function observe() {
  observer?.disconnect()
  await nextTick()
  if (!body.value) return
  measure()
  observer = new ResizeObserver(measure)
  observer.observe(body.value)
}

// Another task starts folded.
watch(
  () => props.task.id,
  () => (expanded.value = false),
)
watch([html, editing], () => void observe())

onMounted(() => {
  if (props.task.can_edit) void loadEditor()
  void observe()
})
onBeforeUnmount(() => observer?.disconnect())

const folded = computed(() => long.value && !expanded.value)

function start() {
  if (!props.task.can_edit || props.saving) return
  draft.value = props.task.description
  editing.value = true
}

/** A click on the description edits it — unless the user was selecting text or following a link. */
function onClick(e: MouseEvent) {
  if ((e.target as HTMLElement).closest('a')) return
  if (!window.getSelection()?.toString()) start()
}

/**
 * The Save and Cancel buttons keep the focus in the field, so pressing one
 * doesn't first save through the field's blur.
 */
function keepFocus(e: MouseEvent) {
  e.preventDefault()
}

async function commit() {
  if (!editing.value || props.saving || tooLong.value) return
  const value = draft.value.trim()
  if (value === props.task.description) {
    editing.value = false
    return
  }
  if (await props.save({ description: value })) editing.value = false
}
</script>

<template>
  <section aria-labelledby="task-description" class="mt-5 min-w-0">
    <h2 id="task-description" class="text-xs font-semibold tracking-wide text-neutral-500 uppercase">{{ $t('task.description') }}</h2>
    <div v-if="editing" class="mt-2">
      <RichTextEditor
        id="task-description-input"
        v-model="draft"
        autofocus
        sticky-top="calc(-1 * var(--task-card-padding, 0px))"
        :rows="5"
        :label="$t('task.description')"
        :disabled="saving"
        :invalid="tooLong"
        :placeholder="$t('task.descriptionPlaceholder')"
        @cancel="editing = false"
        @submit="commit"
        @blur="commit"
      />
      <div class="mt-2 flex items-center justify-end gap-2">
        <span class="mr-auto text-xs" :class="tooLong ? 'text-red-600' : 'text-neutral-400'">
          {{ tooLong ? $t('task.descriptionTooLong', { max: MAX_LENGTH }) : $t('task.ctrlEnterToSave') }}
        </span>
        <BaseButton variant="ghost" size="sm" :block="false" :disabled="saving" @mousedown="keepFocus" @click="editing = false">{{ $t('common.cancel') }}</BaseButton>
        <BaseButton size="sm" :block="false" :loading="saving" :disabled="tooLong" @mousedown="keepFocus" @click="commit">{{ $t('common.save') }}</BaseButton>
      </div>
    </div>
    <template v-else-if="task.description">
      <!-- eslint-disable vue/no-v-html -- markdown-it with html off -->
      <div
        id="task-description-body"
        ref="body"
        class="rich-text mt-2 overflow-hidden text-sm leading-6 break-words text-neutral-800"
        :class="[task.can_edit ? '-mx-2 cursor-text rounded-lg px-2 transition-colors hover:bg-neutral-50' : '', folded ? 'description-folded' : '']"
        :style="folded ? { maxHeight: `${FOLDED}px` } : undefined"
        :title="task.can_edit ? $t('task.clickToEditDescription') : undefined"
        @click="task.can_edit && onClick($event)"
        v-html="html"
      />
      <!-- eslint-enable vue/no-v-html -->
      <button
        v-if="long"
        type="button"
        class="mt-1 inline-flex items-center gap-1 text-xs font-medium text-neutral-500 hover:text-neutral-900"
        aria-controls="task-description-body"
        :aria-expanded="expanded"
        @click="expanded = !expanded"
      >
        {{ expanded ? $t('task.collapseDescription') : $t('task.expandDescription') }}
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-3.5 w-3.5 transition-transform" :class="expanded ? 'rotate-180' : ''" aria-hidden="true">
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>
    </template>
    <p v-else class="mt-2 text-sm text-neutral-400">
      <template v-if="task.can_edit">
        <button type="button" class="font-medium text-neutral-600 underline-offset-4 hover:text-neutral-900 hover:underline" @click="start">
          {{ $t('task.addDescription') }}
        </button>
      </template>
      <template v-else>{{ $t('task.noDescription') }}</template>
    </p>
  </section>
</template>
