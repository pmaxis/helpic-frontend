<script setup lang="ts">
/**
 * The task's description, as formatted text; whoever may edit the task
 * clicks it to change it in place, in a WYSIWYG editor. It's kept as Markdown.
 */
import { computed, defineAsyncComponent, onMounted, ref } from 'vue'
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

const editing = ref(false)
const draft = ref('')
const html = computed(() => renderRichText(props.task.description))
const tooLong = computed(() => draft.value.length > MAX_LENGTH)

onMounted(() => {
  if (props.task.can_edit) void loadEditor()
})

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
    <div v-if="editing" class="mt-3">
      <RichTextEditor
        id="task-description-input"
        autofocus
        sticky-top="calc(-1 * var(--task-card-padding, 0px))"
        v-model="draft"
        :rows="8"
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
    <div
      v-else-if="task.description"
      class="rich-text mt-3 text-[15px] leading-7 break-words text-neutral-800"
      :class="task.can_edit ? '-mx-2 cursor-text rounded-lg px-2 transition-colors hover:bg-neutral-50' : ''"
      :title="task.can_edit ? $t('task.clickToEditDescription') : undefined"
      @click="task.can_edit && onClick($event)"
      v-html="html"
    />
    <div v-else class="mt-3 rounded-xl border border-dashed border-neutral-300 px-4 py-6 text-center">
      <p class="text-sm text-neutral-400">{{ $t('task.noDescription') }}</p>
      <button
        v-if="task.can_edit"
        type="button"
        class="mt-2 text-sm font-medium text-neutral-700 underline-offset-4 hover:text-neutral-900 hover:underline"
        @click="start"
      >
        {{ $t('task.addDescription') }}
      </button>
    </div>
  </section>
</template>
