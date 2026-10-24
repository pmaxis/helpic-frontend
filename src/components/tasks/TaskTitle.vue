<script setup lang="ts">
/** The task's title; whoever may edit the task clicks it to change it in place. */
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
const input = ref<HTMLInputElement | null>(null)

async function start() {
  if (!props.task.can_edit || props.saving) return
  draft.value = props.task.title
  editing.value = true
  await nextTick()
  input.value?.focus()
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
  // An emptied or unchanged title just goes back to how it was.
  if (!value || value === props.task.title) {
    editing.value = false
    return
  }
  if (await props.save({ title: value })) editing.value = false
}
</script>

<template>
  <div v-if="editing" class="min-w-0 flex-1">
    <label for="task-title-input" class="sr-only">{{ $t('task.titleLabel') }}</label>
    <input
      id="task-title-input"
      ref="input"
      v-model="draft"
      type="text"
      maxlength="200"
      :disabled="saving"
      class="-mx-2 -my-1 block w-[calc(100%+1rem)] rounded-lg border border-neutral-300 bg-white px-2 py-1 text-2xl leading-tight font-semibold tracking-tight text-neutral-900 focus:border-neutral-900 focus:ring-2 focus:ring-neutral-900/10 focus:outline-none"
      @keydown.enter.prevent="commit"
      @keydown.esc.prevent="editing = false"
      @blur="commit"
    />
    <div class="mt-2 flex items-center justify-end gap-2">
      <span class="mr-auto text-xs text-neutral-400">{{ $t('task.enterToSave') }}</span>
      <BaseButton variant="ghost" size="sm" :block="false" :disabled="saving" @mousedown="keepFocus" @click="editing = false">{{ $t('common.cancel') }}</BaseButton>
      <BaseButton size="sm" :block="false" :loading="saving" :disabled="!draft.trim()" @mousedown="keepFocus" @click="commit">{{ $t('common.save') }}</BaseButton>
    </div>
  </div>
  <h1 v-else class="min-w-0 flex-1 text-2xl leading-tight font-semibold tracking-tight break-words text-neutral-900">
    <button
      v-if="task.can_edit"
      type="button"
      class="-mx-2 -my-1 w-[calc(100%+1rem)] cursor-text rounded-lg px-2 py-1 text-left transition-colors hover:bg-neutral-100"
      :title="$t('task.clickToEditTitle')"
      @click="start"
    >
      {{ task.title }}
    </button>
    <template v-else>{{ task.title }}</template>
  </h1>
</template>
