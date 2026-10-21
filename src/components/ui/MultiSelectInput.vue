<script setup lang="ts">
/**
 * Picks several options from a list of checkboxes in a popover, styled like
 * the other inputs. Nothing picked shows the placeholder ("All projects").
 * The panel is teleported to <body> with fixed positioning, like SelectInput,
 * so modals don't clip it. Esc or a click outside closes it.
 */
import { computed, onBeforeUnmount, ref, useId, watch } from 'vue'
import FieldLabel from '@/components/ui/FieldLabel.vue'
import { useI18n } from 'vue-i18n'

type Option = { value: string; label: string }

const props = defineProps<{
  modelValue: string[]
  label: string
  options: Option[]
  /** Shown while nothing is picked. */
  placeholder: string
  error?: string
  disabled?: boolean
  required?: boolean
  /** Keep the label for screen readers only, e.g. in a toolbar. */
  hideLabel?: boolean
  /** "sm" is 32px tall, to line up with small buttons in a toolbar. */
  size?: 'md' | 'sm'
  /** Picked values that stay picked. */
  locked?: string[]
}>()

const emit = defineEmits<{ 'update:modelValue': [value: string[]] }>()

const { t } = useI18n()
const id = useId()
const errorId = `${id}-error`
const open = ref(false)
const trigger = ref<HTMLButtonElement | null>(null)
const panel = ref<HTMLDivElement | null>(null)
const panelStyle = ref<Record<string, string>>({})

const picked = computed(() => props.options.filter((o) => props.modelValue.includes(o.value)))
const display = computed(() => {
  if (!picked.value.length) return ''
  if (picked.value.length <= 2) return picked.value.map((o) => o.label).join(', ')
  return t('ui.selected', { n: picked.value.length })
})

function isLocked(value: string): boolean {
  return !!props.locked?.includes(value)
}

function toggle(value: string) {
  if (isLocked(value)) return
  const next = props.modelValue.includes(value) ? props.modelValue.filter((v) => v !== value) : [...props.modelValue, value]
  // Keep the options' order, whatever order they were picked in.
  emit('update:modelValue', props.options.map((o) => o.value).filter((v) => next.includes(v)))
}

function clear() {
  emit(
    'update:modelValue',
    props.options.map((o) => o.value).filter((v) => props.modelValue.includes(v) && isLocked(v)),
  )
}

const canClear = computed(() => props.modelValue.some((v) => !isLocked(v)))

function position() {
  const rect = trigger.value?.getBoundingClientRect()
  if (!rect) return
  const below = window.innerHeight - rect.bottom
  const base = { left: `${rect.left}px`, width: `${rect.width}px` }
  panelStyle.value =
    below < 260 && rect.top > below
      ? { ...base, bottom: `${window.innerHeight - rect.top + 4}px` }
      : { ...base, top: `${rect.bottom + 4}px` }
}

function show() {
  if (props.disabled) return
  position()
  open.value = true
}

function onDocPointer(e: PointerEvent) {
  const t = e.target as Node
  if (!panel.value?.contains(t) && !trigger.value?.contains(t)) open.value = false
}

function onKeydown(e: KeyboardEvent) {
  if (e.key !== 'Escape') return
  // Close just the panel, not an enclosing modal.
  e.stopPropagation()
  open.value = false
  trigger.value?.focus()
}

function stopListening() {
  document.removeEventListener('pointerdown', onDocPointer, true)
  window.removeEventListener('keydown', onKeydown, true)
  window.removeEventListener('resize', position)
  window.removeEventListener('scroll', position, true)
}

watch(open, (isOpen) => {
  if (!isOpen) return stopListening()
  document.addEventListener('pointerdown', onDocPointer, true)
  window.addEventListener('keydown', onKeydown, true)
  window.addEventListener('resize', position)
  window.addEventListener('scroll', position, true)
})
onBeforeUnmount(stopListening)
</script>

<template>
  <div>
    <FieldLabel :target="id" :label="label" :required="required" :hidden="hideLabel" />
    <button
      :id="id"
      ref="trigger"
      type="button"
      aria-haspopup="dialog"
      :aria-expanded="open"
      :aria-invalid="error ? 'true' : undefined"
      :aria-describedby="error ? errorId : undefined"
      :disabled="disabled"
      class="group flex w-full items-center gap-2 rounded-lg border bg-white pr-2.5 pl-3 text-left text-sm shadow-xs transition-colors focus:outline-none disabled:cursor-not-allowed disabled:bg-neutral-50 disabled:text-neutral-400"
      :class="[
        hideLabel ? '' : 'mt-1.5',
        size === 'sm' ? 'h-8' : 'py-2',
        open
          ? 'border-neutral-900 ring-2 ring-neutral-900/10'
          : error
            ? 'border-neutral-900'
            : 'border-neutral-300 hover:border-neutral-400 focus-visible:border-neutral-900 focus-visible:ring-2 focus-visible:ring-neutral-900/10',
      ]"
      @click="open ? (open = false) : show()"
    >
      <span class="min-w-0 flex-1 truncate" :class="display ? 'text-neutral-900' : 'text-neutral-500'">{{ display || placeholder }}</span>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-4 w-4 shrink-0 text-neutral-400 transition-transform" :class="open ? 'rotate-180' : ''" aria-hidden="true">
        <polyline points="6 9 12 15 18 9" />
      </svg>
    </button>
    <p v-if="error" :id="errorId" class="mt-1.5 text-sm text-neutral-600">{{ error }}</p>

    <Teleport to="body">
      <div
        v-if="open"
        ref="panel"
        role="dialog"
        :aria-label="label"
        class="animate-pop-down fixed z-[60] overflow-hidden rounded-lg border border-neutral-200 bg-white text-sm shadow-lg shadow-black/10"
        :style="panelStyle"
      >
        <ul class="max-h-60 overflow-y-auto p-1">
          <li v-if="!options.length" class="px-2.5 py-2 text-neutral-400">{{ t('ui.nothingToChoose') }}</li>
          <li v-for="o in options" :key="o.value">
            <button
              type="button"
              role="checkbox"
              :aria-checked="modelValue.includes(o.value)"
              class="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-neutral-800 hover:bg-neutral-100"
              :class="isLocked(o.value) ? 'cursor-default' : ''"
              @click="toggle(o.value)"
            >
              <span
                class="flex h-4 w-4 shrink-0 items-center justify-center rounded border"
                :class="modelValue.includes(o.value) ? 'border-neutral-900 bg-neutral-900 text-white' : 'border-neutral-300 bg-white'"
                aria-hidden="true"
              >
                <svg v-if="modelValue.includes(o.value)" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round" class="h-2.5 w-2.5">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </span>
              <span class="min-w-0 flex-1 truncate">{{ o.label }}</span>
            </button>
          </li>
        </ul>
        <div v-if="canClear" class="border-t border-neutral-100 p-1">
          <button type="button" class="w-full rounded-md px-2.5 py-1.5 text-left text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900" @click="clear">
            {{ placeholder }}
          </button>
        </div>
      </div>
    </Teleport>
  </div>
</template>
