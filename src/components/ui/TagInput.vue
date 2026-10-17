<script setup lang="ts">
import { ref } from 'vue'

/**
 * Chips editor: Enter or comma adds the typed value, Backspace on an empty
 * field removes the last chip, pasting "a, b, c" adds all three.
 */
const props = defineProps<{
  modelValue: string[]
  placeholder?: string
  invalid?: boolean
  id?: string
}>()

const emit = defineEmits<{ 'update:modelValue': [value: string[]] }>()

const draft = ref('')
const input = ref<HTMLInputElement | null>(null)

function add(raw: string) {
  const next = [...props.modelValue]
  for (const part of raw.split(',')) {
    const v = part.trim()
    if (v && !next.some((x) => x.toLowerCase() === v.toLowerCase())) next.push(v)
  }
  if (next.length !== props.modelValue.length) emit('update:modelValue', next)
  draft.value = ''
}

function remove(i: number) {
  emit('update:modelValue', props.modelValue.filter((_, j) => j !== i))
  input.value?.focus()
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter' || e.key === ',') {
    e.preventDefault()
    add(draft.value)
  } else if (e.key === 'Backspace' && draft.value === '' && props.modelValue.length) {
    remove(props.modelValue.length - 1)
  }
}

function onPaste(e: ClipboardEvent) {
  const text = e.clipboardData?.getData('text') ?? ''
  if (text.includes(',')) {
    e.preventDefault()
    add(text)
  }
}
</script>

<template>
  <div
    class="flex min-h-[38px] w-full cursor-text flex-wrap items-center gap-1.5 rounded-lg border bg-white px-2 py-1.5 shadow-xs transition-colors focus-within:border-neutral-900 focus-within:ring-2 focus-within:ring-neutral-900/10"
    :class="invalid ? 'border-neutral-900' : 'border-neutral-300 hover:border-neutral-400'"
    @click="input?.focus()"
  >
    <span
      v-for="(tag, i) in modelValue"
      :key="tag"
      class="inline-flex items-center gap-1 rounded-md bg-neutral-100 py-0.5 pr-1 pl-2 text-sm text-neutral-800 ring-1 ring-neutral-200 ring-inset"
    >
      {{ tag }}
      <button
        type="button"
        class="rounded p-0.5 text-neutral-400 hover:bg-neutral-200 hover:text-neutral-900"
        :aria-label="`Remove ${tag}`"
        @click.stop="remove(i)"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" class="h-3 w-3">
          <path d="M18 6 6 18M6 6l12 12" />
        </svg>
      </button>
    </span>
    <input
      :id="id"
      ref="input"
      v-model="draft"
      type="text"
      :placeholder="modelValue.length ? '' : placeholder"
      class="min-w-[8rem] flex-1 border-0 bg-transparent px-1 py-0.5 text-sm text-neutral-900 placeholder:text-neutral-400 focus:outline-none"
      @keydown="onKeydown"
      @paste="onPaste"
      @blur="add(draft)"
    />
  </div>
</template>
