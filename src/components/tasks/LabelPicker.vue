<script setup lang="ts">
/**
 * Picks a task's labels from its board, in a popover: type to find a label
 * or create one, click to put it on or take it off, and rename, recolor or
 * delete a label from its row. Each pick saves at once (the parent saves the
 * set it gets in "update:modelValue").
 *
 * The panel is teleported to <body> with fixed positioning, like SelectInput,
 * so a scrolling details panel never clips it.
 */
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { createLabel, deleteLabel, fetchLabels, updateLabel } from '@/stores/board'
import { ApiRequestError } from '@/services/api'
import { LABEL_COLOR_NAMES, LABEL_COLORS } from '@/constants/tasks'
import { toast } from '@/composables/useToasts'
import { t } from '@/i18n'
import type { BoardLabel, BoardScope } from '@/types/board'

const props = defineProps<{
  /** IDs of the labels on the task. */
  modelValue: string[]
  /** The task's board. */
  scope: BoardScope
  disabled?: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [ids: string[]]
  /** A label was renamed, recolored or deleted: tasks showing it should reload. */
  'labels-changed': []
}>()

const open = ref(false)
const trigger = ref<HTMLButtonElement | null>(null)
const panel = ref<HTMLDivElement | null>(null)
const search = ref<HTMLInputElement | null>(null)
const panelStyle = ref<Record<string, string>>({})

const labels = ref<BoardLabel[]>([])
const query = ref('')
const busy = ref(false)

const selected = computed(() => new Set(props.modelValue))
const filtered = computed(() => {
  const q = query.value.trim().toLowerCase()
  return q ? labels.value.filter((l) => l.name.toLowerCase().includes(q)) : labels.value
})
/** Offer to create the typed name unless a label already has it. */
const canCreate = computed(() => {
  const q = query.value.trim().toLowerCase()
  return !!q && !labels.value.some((l) => l.name.toLowerCase() === q)
})
/** New labels take the next color of the palette. */
const newColor = ref('blue')

async function load() {
  try {
    labels.value = await fetchLabels(props.scope)
    newColor.value = LABEL_COLOR_NAMES[(labels.value.length + 6) % LABEL_COLOR_NAMES.length]
  } catch {
    toast.error(t('labels.loadFailed'))
  }
}

// --- open / close / position ------------------------------------------------------

function position() {
  const rect = trigger.value?.getBoundingClientRect()
  if (!rect) return
  const width = 264
  const left = Math.max(8, Math.min(rect.left, window.innerWidth - width - 8))
  const below = window.innerHeight - rect.bottom
  panelStyle.value =
    below < 320 && rect.top > below
      ? { left: `${left}px`, bottom: `${window.innerHeight - rect.top + 6}px`, width: `${width}px` }
      : { left: `${left}px`, top: `${rect.bottom + 6}px`, width: `${width}px` }
}

async function show() {
  if (props.disabled) return
  open.value = true
  query.value = ''
  editing.value = null
  position()
  void load()
  await nextTick()
  search.value?.focus()
}

function close() {
  open.value = false
  trigger.value?.focus()
}

function onDocPointer(e: PointerEvent) {
  const t = e.target as Node
  if (!panel.value?.contains(t) && !trigger.value?.contains(t)) open.value = false
}

function onKeydown(e: KeyboardEvent) {
  if (e.key !== 'Escape') return
  e.stopPropagation()
  if (editing.value) editing.value = null
  else close()
}

watch(open, (isOpen) => {
  if (isOpen) {
    document.addEventListener('pointerdown', onDocPointer, true)
    window.addEventListener('keydown', onKeydown, true)
    window.addEventListener('resize', position)
    window.addEventListener('scroll', position, true)
  } else {
    stopListening()
  }
})

function stopListening() {
  document.removeEventListener('pointerdown', onDocPointer, true)
  window.removeEventListener('keydown', onKeydown, true)
  window.removeEventListener('resize', position)
  window.removeEventListener('scroll', position, true)
}
onBeforeUnmount(stopListening)

// --- picking and creating ---------------------------------------------------------

function toggle(id: string) {
  const ids = selected.value.has(id) ? props.modelValue.filter((x) => x !== id) : [...props.modelValue, id]
  emit('update:modelValue', ids)
}

function errorText(error: unknown, fallback: string): string {
  if (!(error instanceof ApiRequestError)) return fallback
  return Object.values(error.fields ?? {})[0] ?? error.message
}

async function create() {
  if (!canCreate.value || busy.value) return
  busy.value = true
  try {
    const label = await createLabel(props.scope, query.value.trim(), newColor.value)
    labels.value = [...labels.value, label].sort((a, b) => a.name.localeCompare(b.name))
    query.value = ''
    newColor.value = LABEL_COLOR_NAMES[(LABEL_COLOR_NAMES.indexOf(newColor.value) + 1) % LABEL_COLOR_NAMES.length]
    emit('update:modelValue', [...props.modelValue, label.id])
  } catch (error) {
    toast.error(errorText(error, t('labels.createFailed')))
  } finally {
    busy.value = false
  }
}

/** Enter picks the only match, or creates the typed label. */
function onEnter() {
  if (canCreate.value && !filtered.value.length) void create()
  else if (filtered.value.length === 1) toggle(filtered.value[0].id)
  else if (canCreate.value) void create()
}

// --- editing a label ------------------------------------------------------------------

const editing = ref<{ id: string; name: string; color: string } | null>(null)

async function startEdit(l: BoardLabel) {
  editing.value = { id: l.id, name: l.name, color: l.color }
  await nextTick()
  document.getElementById(`label-edit-${l.id}`)?.focus()
}

async function saveEdit() {
  const e = editing.value
  if (!e || !e.name.trim() || busy.value) return
  busy.value = true
  try {
    const label = await updateLabel(e.id, e.name.trim(), e.color)
    labels.value = labels.value.map((l) => (l.id === label.id ? { ...label, task_count: l.task_count } : l))
    editing.value = null
    emit('labels-changed')
  } catch (error) {
    toast.error(errorText(error, t('labels.saveFailed')))
  } finally {
    busy.value = false
  }
}

async function removeLabel() {
  const e = editing.value
  if (!e || busy.value) return
  busy.value = true
  try {
    await deleteLabel(e.id)
    labels.value = labels.value.filter((l) => l.id !== e.id)
    editing.value = null
    emit('labels-changed')
  } catch (error) {
    toast.error(errorText(error, t('labels.deleteFailed')))
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <button
    ref="trigger"
    type="button"
    class="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-medium text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-900 disabled:opacity-50"
    :disabled="disabled"
    :aria-expanded="open"
    aria-haspopup="dialog"
    @click="open ? close() : show()"
  >
    <slot>{{ modelValue.length ? $t('labels.edit') : $t('labels.add') }}</slot>
  </button>

  <Teleport to="body">
    <div
      v-if="open"
      ref="panel"
      role="dialog"
      :aria-label="$t('labels.aria')"
      class="animate-pop-down fixed z-50 overflow-hidden rounded-xl border border-neutral-200 bg-white text-sm shadow-lg shadow-black/10"
      :style="panelStyle"
    >
      <div class="border-b border-neutral-100 p-2">
        <input
          ref="search"
          v-model="query"
          type="text"
          maxlength="40"
          :placeholder="$t('labels.findOrCreate')"
          :aria-label="$t('labels.findOrCreateAria')"
          class="block w-full rounded-md border border-neutral-200 px-2 py-1.5 text-sm placeholder:text-neutral-400 focus:border-neutral-900 focus:ring-2 focus:ring-neutral-900/10 focus:outline-none"
          @keydown.enter.prevent="onEnter"
        />
      </div>

      <ul class="max-h-64 overflow-y-auto p-1">
        <li v-for="l in filtered" :key="l.id">
          <!-- editing this label -->
          <div v-if="editing?.id === l.id" class="space-y-2 rounded-lg bg-neutral-50 p-2">
            <input
              :id="`label-edit-${l.id}`"
              v-model="editing.name"
              type="text"
              maxlength="40"
              :aria-label="$t('labels.name')"
              class="block w-full rounded-md border border-neutral-200 bg-white px-2 py-1 text-sm focus:border-neutral-900 focus:ring-2 focus:ring-neutral-900/10 focus:outline-none"
              @keydown.enter.prevent="saveEdit"
            />
            <div class="flex flex-wrap gap-1.5" role="radiogroup" :aria-label="$t('labels.color')">
              <button
                v-for="c in LABEL_COLOR_NAMES"
                :key="c"
                type="button"
                role="radio"
                :aria-checked="editing.color === c"
                :aria-label="$t(`labels.colors.${c}`)"
                class="h-5 w-5 rounded-full ring-offset-2 transition"
                :class="[LABEL_COLORS[c].dot, editing.color === c ? 'ring-2 ring-neutral-900' : 'hover:scale-110']"
                @click="editing.color = c"
              />
            </div>
            <div class="flex items-center justify-between gap-2">
              <button type="button" class="rounded px-1.5 py-0.5 text-xs font-medium text-red-600 hover:bg-red-50" :disabled="busy" @click="removeLabel">
                {{ l.task_count ? $t('labels.deleteOn', { n: l.task_count }) : $t('labels.delete') }}
              </button>
              <span class="flex gap-1">
                <button type="button" class="rounded px-1.5 py-0.5 text-xs text-neutral-500 hover:bg-neutral-200/60" @click="editing = null">{{ $t('common.cancel') }}</button>
                <button type="button" class="rounded bg-neutral-900 px-2 py-0.5 text-xs font-medium text-white hover:bg-neutral-800 disabled:bg-neutral-300" :disabled="busy || !editing.name.trim()" @click="saveEdit">{{ $t('common.save') }}</button>
              </span>
            </div>
          </div>

          <!-- a label to put on or take off -->
          <div v-else class="group flex items-center rounded-md hover:bg-neutral-100">
            <button
              type="button"
              role="checkbox"
              :aria-checked="selected.has(l.id)"
              class="flex min-w-0 flex-1 items-center gap-2 px-2 py-1.5 text-left"
              @click="toggle(l.id)"
            >
              <span
                class="flex h-4 w-4 shrink-0 items-center justify-center rounded border"
                :class="selected.has(l.id) ? 'border-neutral-900 bg-neutral-900 text-white' : 'border-neutral-300 bg-white'"
                aria-hidden="true"
              >
                <svg v-if="selected.has(l.id)" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round" class="h-2.5 w-2.5">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </span>
              <span class="h-2.5 w-2.5 shrink-0 rounded-full" :class="(LABEL_COLORS[l.color] ?? LABEL_COLORS.gray).dot" aria-hidden="true" />
              <span class="min-w-0 flex-1 truncate text-neutral-800">{{ l.name }}</span>
            </button>
            <button
              type="button"
              class="mr-1 shrink-0 rounded p-1 text-neutral-400 opacity-0 transition group-hover:opacity-100 hover:bg-neutral-200/70 hover:text-neutral-900 focus-visible:opacity-100 [@media(hover:none)]:opacity-100"
              :aria-label="$t('labels.editNamed', { name: l.name })"
              :title="$t('labels.manage')"
              @click="startEdit(l)"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-3 w-3" aria-hidden="true">
                <path d="M12 20h9" />
                <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
              </svg>
            </button>
          </div>
        </li>

        <li v-if="!filtered.length && !canCreate" class="px-2 py-3 text-center text-xs text-neutral-400">
          {{ $t('labels.none') }}
        </li>
      </ul>

      <!-- create the typed label -->
      <div v-if="canCreate" class="border-t border-neutral-100 p-2">
        <button
          type="button"
          class="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left hover:bg-neutral-100 disabled:opacity-50"
          :disabled="busy"
          @click="create"
        >
          <span class="h-2.5 w-2.5 shrink-0 rounded-full" :class="LABEL_COLORS[newColor].dot" aria-hidden="true" />
          <span class="min-w-0 flex-1 truncate text-neutral-700">{{ $t('labels.create', { name: query.trim() }) }}</span>
        </button>
        <div class="mt-1.5 flex flex-wrap gap-1.5 px-2" role="radiogroup" :aria-label="$t('labels.newColor')">
          <button
            v-for="c in LABEL_COLOR_NAMES"
            :key="c"
            type="button"
            role="radio"
            :aria-checked="newColor === c"
            :aria-label="$t(`labels.colors.${c}`)"
            class="h-4 w-4 rounded-full ring-offset-1 transition"
            :class="[LABEL_COLORS[c].dot, newColor === c ? 'ring-2 ring-neutral-900' : 'hover:scale-110']"
            @click="newColor = c"
          />
        </div>
      </div>
    </div>
  </Teleport>
</template>
