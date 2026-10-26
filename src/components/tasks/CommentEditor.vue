<script setup lang="ts">
/**
 * The box a comment is written in. Typing @ lists who sees the task to
 * mention: ↑/↓ pick, Enter or Tab puts the name in, Esc closes the list
 * (and only the list). It grows with its text.
 */
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { matchesMention, mentionAt, mentionLabels } from '@/utils/commentText'
import type { CommentPerson } from '@/types/comments'

const props = withDefaults(
  defineProps<{
    modelValue: string
    /** Who can be mentioned; the writer is left out of the list. */
    people: CommentPerson[]
    selfId?: string
    id: string
    placeholder?: string
    disabled?: boolean
    rows?: number
    /** Where the list opens: above the box at the bottom of the discussion, below one inside it. */
    placement?: 'above' | 'below'
    textareaClass?: string
  }>(),
  { rows: 1, placement: 'below' },
)
const emit = defineEmits<{ 'update:modelValue': [value: string] }>()

const box = ref<HTMLTextAreaElement | null>(null)
const query = ref<{ start: number; query: string } | null>(null)
const active = ref(0)

/** Grows the box with its text, up to its max-height. */
function grow() {
  const el = box.value
  if (!el) return
  el.style.height = 'auto'
  el.style.height = `${el.scrollHeight}px`
}
watch(
  () => props.modelValue,
  () => void nextTick(grow),
)
onMounted(grow)

const options = computed(() => {
  const q = query.value
  if (!q) return []
  return [...mentionLabels(props.people)]
    .filter(([label, p]) => p.id !== props.selfId && matchesMention(label, p, q.query))
    .slice(0, 8)
    .map(([label, p]) => ({ label, person: p }))
})
const open = computed(() => !!query.value && options.value.length > 0)
const listId = computed(() => `${props.id}-mentions`)

/** Looks for an @ being typed at the caret. */
function track() {
  const el = box.value
  if (!el || !props.people.length || el.selectionStart !== el.selectionEnd) {
    query.value = null
    return
  }
  const found = mentionAt(el.value, el.selectionStart)
  if (found?.query !== query.value?.query || found?.start !== query.value?.start) active.value = 0
  query.value = found
}

function onInput(e: Event) {
  emit('update:modelValue', (e.target as HTMLTextAreaElement).value)
  track()
}

async function pick(label: string) {
  const el = box.value
  const q = query.value
  if (!el || !q) return
  const end = q.start + 1 + q.query.length
  const before = el.value.slice(0, q.start) + '@' + label + ' '
  emit('update:modelValue', before + el.value.slice(end))
  query.value = null
  await nextTick()
  el.focus()
  el.setSelectionRange(before.length, before.length)
}

function onKeydown(e: KeyboardEvent) {
  if (!open.value || e.isComposing) return
  const n = options.value.length
  switch (e.key) {
    case 'ArrowDown':
      active.value = (active.value + 1) % n
      break
    case 'ArrowUp':
      active.value = (active.value - 1 + n) % n
      break
    case 'Enter':
    case 'Tab':
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
      void pick(options.value[active.value].label)
      break
    case 'Escape':
      query.value = null
      break
    default:
      return
  }
  e.preventDefault()
  e.stopPropagation()
}
</script>

<template>
  <div class="relative">
    <textarea
      :id="id"
      ref="box"
      :value="modelValue"
      :rows="rows"
      maxlength="10000"
      :placeholder="placeholder"
      :disabled="disabled"
      :class="textareaClass"
      role="combobox"
      aria-autocomplete="list"
      :aria-expanded="open"
      :aria-controls="open ? listId : undefined"
      :aria-activedescendant="open ? `${listId}-${active}` : undefined"
      @input="onInput"
      @keydown="onKeydown"
      @keyup="(e) => { if (!['ArrowDown', 'ArrowUp', 'Enter', 'Tab', 'Escape'].includes(e.key)) track() }"
      @click="track"
      @blur="query = null"
    />
    <ul
      v-if="open"
      :id="listId"
      role="listbox"
      :aria-label="$t('comments.mentionPeople')"
      class="absolute left-0 z-20 max-h-60 w-64 max-w-full overflow-y-auto rounded-lg border border-neutral-200 bg-white py-1 shadow-lg"
      :class="placement === 'above' ? 'bottom-full mb-1 animate-pop-up' : 'top-full mt-1 animate-pop-down'"
    >
      <li
        v-for="(o, i) in options"
        :id="`${listId}-${i}`"
        :key="o.person.id"
        role="option"
        :aria-selected="i === active"
        class="flex cursor-pointer flex-col px-3 py-1.5 text-sm"
        :class="i === active ? 'bg-neutral-100' : ''"
        @mousedown.prevent="pick(o.label)"
        @mousemove="active = i"
      >
        <span class="truncate font-medium text-neutral-900">{{ o.person.name || o.person.email }}</span>
        <span v-if="o.person.name" class="truncate text-xs text-neutral-500">{{ o.person.email }}</span>
      </li>
    </ul>
  </div>
</template>
