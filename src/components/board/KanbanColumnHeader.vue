<script setup lang="ts">
/**
 * A board column's header: its status dot, name and task count. Whoever
 * manages the board drags it to move the column (the board listens for the
 * drag), clicks the name to rename it, and edits, moves or deletes the column
 * from the "⋯" menu.
 */
import { computed, nextTick, ref } from 'vue'
import ActionMenu, { type MenuAction } from '@/components/ui/ActionMenu.vue'
import { columnName, STATUS_DOT } from '@/constants/tasks'
import { t as tr } from '@/i18n'
import type { BoardColumn } from '@/types/board'

const props = defineProps<{
  column: BoardColumn
  count: number
  canManage: boolean
  canMoveLeft: boolean
  canMoveRight: boolean
}>()
const emit = defineEmits<{
  /** A new name, already trimmed and different from the old one. */
  rename: [name: string]
  edit: []
  shift: [step: -1 | 1]
  remove: []
}>()

// --- renaming in place ----------------------------------------------------------

const renaming = ref(false)
const renameValue = ref('')
const renameInput = ref<HTMLInputElement | null>(null)

async function startRename() {
  if (!props.canManage) return
  renaming.value = true
  renameValue.value = props.column.name
  await nextTick()
  renameInput.value?.focus()
  renameInput.value?.select()
}

function finishRename() {
  if (!renaming.value) return
  renaming.value = false
  const name = renameValue.value.trim()
  if (name && name !== props.column.name) emit('rename', name)
}

// --- column menu --------------------------------------------------------------

const actions = computed(() => {
  const list: MenuAction[] = [{ label: tr('board.edit'), onSelect: () => emit('edit') }]
  if (props.canMoveLeft) list.push({ label: tr('board.moveLeft'), onSelect: () => emit('shift', -1) })
  if (props.canMoveRight) list.push({ label: tr('board.moveRight'), onSelect: () => emit('shift', 1) })
  list.push({ label: tr('board.delete'), danger: true, onSelect: () => emit('remove') })
  return list
})
</script>

<template>
  <header
    class="flex items-center gap-2 rounded-t-xl px-3 pt-3 pb-2"
    :class="canManage ? 'cursor-grab active:cursor-grabbing' : ''"
    :draggable="canManage && !renaming"
    data-column-handle
    :title="canManage && !renaming ? $t('board.dragToMove', { name: column.name }) : undefined"
  >
    <span class="h-2 w-2 shrink-0 rounded-full" :class="STATUS_DOT[column.category]" :title="columnName(column.name)" />
    <input
      v-if="renaming"
      ref="renameInput"
      v-model="renameValue"
      type="text"
      maxlength="60"
      :aria-label="$t('board.rename', { name: column.name })"
      class="-my-1 min-w-0 flex-1 rounded-md border border-neutral-900 bg-white px-1.5 py-0.5 text-sm font-semibold text-neutral-900 ring-2 ring-neutral-900/10 focus:outline-none"
      @keydown.enter.prevent="finishRename"
      @keydown.esc.stop.prevent="renaming = false"
      @blur="finishRename"
    />
    <h3
      v-else
      class="-mx-1 min-w-0 flex-1 truncate rounded-md px-1 text-sm font-semibold text-neutral-900"
      :class="canManage ? 'cursor-text transition-colors hover:bg-neutral-200/70' : ''"
      :title="canManage ? $t('board.clickToRename') : undefined"
      @click="startRename"
    >
      {{ columnName(column.name) }}
    </h3>
    <span class="text-xs text-neutral-500">{{ count }}</span>
    <ActionMenu v-if="canManage" variant="plain" :actions="actions" :label="`${column.name} column options`" data-column-menu />
  </header>
</template>
