<script setup lang="ts">
/** The task's description; whoever may edit the task clicks it to change it in place. */
import { nextTick, ref } from 'vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import type { Task, TaskInput } from '@/types/tasks'

const props = defineProps<{
  task: Task
  saving: boolean
  /** Saves one change to the task; false when it was refused. */
  save: (change: Partial<TaskInput>) => Promise<boolean>
}>()

const editing = ref(false)
const draft = ref('')
const input = ref<HTMLTextAreaElement | null>(null)

async function start() {
  if (!props.task.can_edit || props.saving) return
  draft.value = props.task.description
  editing.value = true
  await nextTick()
  const el = input.value
  el?.focus()
  el?.setSelectionRange(el.value.length, el.value.length)
}

/** A click on the description edits it — unless the user was selecting text. */
function onClick() {
  if (!window.getSelection()?.toString()) void start()
}

/**
 * The Save and Cancel buttons keep the focus in the field, so pressing one
 * doesn't first save through the field's blur.
 */
function keepFocus(e: MouseEvent) {
  e.preventDefault()
}

async function commit() {
  if (!editing.value || props.saving) return
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
      <label for="task-description-input" class="sr-only">{{ $t('task.description') }}</label>
      <textarea
        id="task-description-input"
        ref="input"
        v-model="draft"
        rows="8"
        maxlength="20000"
        :disabled="saving"
        :placeholder="$t('task.descriptionPlaceholder')"
        class="block w-full resize-y rounded-lg border border-neutral-300 bg-white px-3 py-2 text-[15px] leading-7 text-neutral-900 placeholder:text-neutral-400 focus:border-neutral-900 focus:ring-2 focus:ring-neutral-900/10 focus:outline-none"
        @keydown.esc.prevent="editing = false"
        @keydown.meta.enter.prevent="commit"
        @keydown.ctrl.enter.prevent="commit"
        @blur="commit"
      />
      <div class="mt-2 flex items-center justify-end gap-2">
        <span class="mr-auto text-xs text-neutral-400">{{ $t('task.ctrlEnterToSave') }}</span>
        <BaseButton variant="ghost" size="sm" :block="false" :disabled="saving" @mousedown="keepFocus" @click="editing = false">{{ $t('common.cancel') }}</BaseButton>
        <BaseButton size="sm" :block="false" :loading="saving" @mousedown="keepFocus" @click="commit">{{ $t('common.save') }}</BaseButton>
      </div>
    </div>
    <div
      v-else-if="task.description"
      class="mt-3 text-[15px] leading-7 whitespace-pre-wrap break-words text-neutral-800"
      :class="task.can_edit ? '-mx-2 cursor-text rounded-lg px-2 transition-colors hover:bg-neutral-50' : ''"
      :title="task.can_edit ? $t('task.clickToEditDescription') : undefined"
      @click="task.can_edit && onClick()"
    >{{ task.description }}</div>
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
