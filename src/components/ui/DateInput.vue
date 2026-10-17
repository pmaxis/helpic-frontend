<script setup lang="ts">
/**
 * Date picker bound to a "YYYY-MM-DD" string ('' = not set), styled like the
 * other inputs. Replaces the native date input, whose look and calendar
 * depend on the browser and OS locale.
 *
 * The calendar is teleported to <body> with fixed positioning (like
 * SelectInput) so modals don't clip it, and flips up when there is no room
 * below. Keyboard: arrows move by day/week, PageUp/PageDown by month,
 * Home/End to the week's start/end, Enter/Space pick, Esc closes.
 */
import { computed, nextTick, onBeforeUnmount, ref, useId, watch } from 'vue'

const props = defineProps<{
  modelValue: string
  label: string
  placeholder?: string
  error?: string
  disabled?: boolean
  /** Keep the label for screen readers only, e.g. inline in a details list. */
  hideLabel?: boolean
  /** Show the date without the weekday ("3 Oct 2026"), for narrow places. */
  compact?: boolean
}>()

const emit = defineEmits<{ 'update:modelValue': [value: string] }>()

const id = useId()
const errorId = `${id}-error`
const gridId = `${id}-grid`

// --- dates ------------------------------------------------------------------------

/** Local calendar day as YYYY-MM-DD (not via toISOString, which is UTC). */
function toISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function parse(value: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null
}

function addDays(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n)
}

/** Same day n months later, clamped to the month's last day (31 Jan + 1 → 28/29 Feb). */
function addMonths(d: Date, n: number): Date {
  const last = new Date(d.getFullYear(), d.getMonth() + n + 1, 0).getDate()
  return new Date(d.getFullYear(), d.getMonth() + n, Math.min(d.getDate(), last))
}

const todayISO = toISO(new Date())
const selected = computed(() => parse(props.modelValue))

const displayLabel = computed(() =>
  selected.value
    ? selected.value.toLocaleDateString('en-GB', {
        weekday: props.compact ? undefined : 'short',
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
    : '',
)

// Weeks start on Monday.
const WEEKDAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su']

/** The day keyboard focus is on; its month is the one shown. */
const cursor = ref(selected.value ?? new Date())

const monthLabel = computed(() => cursor.value.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' }))

/** Six weeks covering the shown month, padded with the neighbouring months' days. */
const days = computed(() => {
  const first = new Date(cursor.value.getFullYear(), cursor.value.getMonth(), 1)
  const start = addDays(first, -((first.getDay() + 6) % 7))
  return Array.from({ length: 42 }, (_, i) => {
    const d = addDays(start, i)
    return { date: d, iso: toISO(d), day: d.getDate(), inMonth: d.getMonth() === cursor.value.getMonth() }
  })
})

const cursorISO = computed(() => toISO(cursor.value))

// --- open / close / pick ------------------------------------------------------------

const trigger = ref<HTMLButtonElement | null>(null)
const panel = ref<HTMLDivElement | null>(null)
const open = ref(false)
const panelStyle = ref<Record<string, string>>({})
const placement = ref<'bottom' | 'top'>('bottom')

const GAP = 6

function position() {
  const el = trigger.value
  if (!el) return
  const r = el.getBoundingClientRect()
  const height = panel.value?.offsetHeight ?? 340
  const width = panel.value?.offsetWidth ?? 296
  const below = window.innerHeight - r.bottom - GAP - 8
  placement.value = below < height && r.top > below ? 'top' : 'bottom'
  const left = Math.max(8, Math.min(r.left, window.innerWidth - width - 8))
  panelStyle.value = {
    position: 'fixed',
    left: `${left}px`,
    ...(placement.value === 'bottom'
      ? { top: `${r.bottom + GAP}px` }
      : { bottom: `${window.innerHeight - r.top + GAP}px` }),
  }
}

function focusCursor() {
  nextTick(() => panel.value?.querySelector<HTMLElement>(`[data-iso="${cursorISO.value}"]`)?.focus())
}

async function openPanel() {
  if (props.disabled || open.value) return
  cursor.value = selected.value ?? new Date()
  open.value = true
  await nextTick()
  position()
  focusCursor()
}

function close(refocus = true) {
  if (!open.value) return
  open.value = false
  if (refocus) trigger.value?.focus()
}

function pick(iso: string) {
  emit('update:modelValue', iso)
  close()
}

function clear() {
  emit('update:modelValue', '')
  close()
}

function shiftMonth(n: number) {
  cursor.value = addMonths(cursor.value, n)
}

function onPointerDownOutside(e: PointerEvent) {
  const t = e.target as Node
  if (trigger.value?.contains(t) || panel.value?.contains(t)) return
  close(false)
}

function onViewportChange(e: Event) {
  if (e.type === 'scroll' && panel.value?.contains(e.target as Node)) return
  position()
}

watch(open, (isOpen) => {
  const method = isOpen ? 'addEventListener' : 'removeEventListener'
  window[method]('scroll', onViewportChange, true)
  window[method]('resize', onViewportChange)
  document[method]('pointerdown', onPointerDownOutside as EventListener, true)
})

onBeforeUnmount(() => {
  window.removeEventListener('scroll', onViewportChange, true)
  window.removeEventListener('resize', onViewportChange)
  document.removeEventListener('pointerdown', onPointerDownOutside as EventListener, true)
})

// --- keyboard ---------------------------------------------------------------------

function onTriggerKeydown(e: KeyboardEvent) {
  if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
    e.preventDefault()
    void openPanel()
  }
}

function onGridKeydown(e: KeyboardEvent) {
  const moves: Record<string, () => Date> = {
    ArrowLeft: () => addDays(cursor.value, -1),
    ArrowRight: () => addDays(cursor.value, 1),
    ArrowUp: () => addDays(cursor.value, -7),
    ArrowDown: () => addDays(cursor.value, 7),
    PageUp: () => addMonths(cursor.value, -1),
    PageDown: () => addMonths(cursor.value, 1),
    Home: () => addDays(cursor.value, -((cursor.value.getDay() + 6) % 7)),
    End: () => addDays(cursor.value, 6 - ((cursor.value.getDay() + 6) % 7)),
  }
  if (moves[e.key]) {
    e.preventDefault()
    cursor.value = moves[e.key]()
    focusCursor()
  } else if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault()
    pick(cursorISO.value)
  }
}

function onPanelKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    // Close just the calendar, not an enclosing modal.
    e.preventDefault()
    e.stopPropagation()
    close()
  } else if (e.key === 'Tab') {
    close(false)
  }
}
</script>

<template>
  <div>
    <label :for="id" :class="hideLabel ? 'sr-only' : 'block text-sm font-medium text-neutral-700'">{{ label }}</label>
    <div class="relative" :class="hideLabel ? '' : 'mt-1.5'">
      <button
        :id="id"
        ref="trigger"
        type="button"
        aria-haspopup="dialog"
        :aria-expanded="open"
        :aria-invalid="error ? 'true' : undefined"
        :aria-describedby="error ? errorId : undefined"
        :disabled="disabled"
        class="group flex w-full items-center gap-2 rounded-lg border bg-white py-2 pl-3 text-left text-sm shadow-xs transition-colors focus:outline-none disabled:cursor-not-allowed disabled:bg-neutral-50 disabled:text-neutral-400"
        :class="[
          // room for the clear button, which sits on top of the trigger
          modelValue && !disabled ? 'pr-9' : 'pr-2.5',
          open
            ? 'border-neutral-900 ring-2 ring-neutral-900/10'
            : error
              ? 'border-neutral-900'
              : 'border-neutral-300 hover:border-neutral-400 focus-visible:border-neutral-900 focus-visible:ring-2 focus-visible:ring-neutral-900/10',
        ]"
        @click="open ? close() : openPanel()"
        @keydown="onTriggerKeydown"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          class="h-4 w-4 shrink-0 transition-colors"
          :class="open ? 'text-neutral-700' : 'text-neutral-400 group-hover:text-neutral-500'"
          aria-hidden="true"
        >
          <rect x="3" y="4" width="18" height="18" rx="2" />
          <path d="M16 2v4M8 2v4M3 10h18" />
        </svg>
        <span class="min-w-0 flex-1 truncate" :class="displayLabel ? 'text-neutral-900' : 'text-neutral-400'">
          {{ displayLabel || placeholder || 'Pick a date' }}
        </span>
      </button>
      <button
        v-if="modelValue && !disabled"
        type="button"
        class="absolute top-1/2 right-2 -translate-y-1/2 rounded-md p-1 text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-900"
        aria-label="Clear date"
        @click="clear"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-3.5 w-3.5">
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>
    </div>
    <p v-if="error" :id="errorId" class="mt-1.5 text-sm text-neutral-600">{{ error }}</p>

    <Teleport to="body">
      <div
        v-if="open"
        ref="panel"
        role="dialog"
        :aria-label="`Choose ${label.toLowerCase()}`"
        :style="panelStyle"
        class="z-[60] w-74 rounded-xl border border-neutral-200 bg-white p-3 shadow-lg shadow-neutral-900/10"
        :class="placement === 'bottom' ? 'animate-pop-down' : 'animate-pop-up'"
        @keydown="onPanelKeydown"
      >
        <div class="flex items-center justify-between">
          <button
            type="button"
            class="rounded-md p-1.5 text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-900"
            aria-label="Previous month"
            @click="shiftMonth(-1)"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-4 w-4">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
          <p class="text-sm font-semibold text-neutral-900" aria-live="polite">{{ monthLabel }}</p>
          <button
            type="button"
            class="rounded-md p-1.5 text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-900"
            aria-label="Next month"
            @click="shiftMonth(1)"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-4 w-4">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
        </div>

        <div :id="gridId" role="grid" class="mt-2" @keydown="onGridKeydown">
          <div role="row" class="grid grid-cols-7">
            <span
              v-for="w in WEEKDAYS"
              :key="w"
              role="columnheader"
              class="flex h-8 items-center justify-center text-xs font-medium text-neutral-400"
            >
              {{ w }}
            </span>
          </div>
          <div role="row" class="grid grid-cols-7 gap-y-0.5">
            <button
              v-for="d in days"
              :key="d.iso"
              type="button"
              role="gridcell"
              :data-iso="d.iso"
              :tabindex="d.iso === cursorISO ? 0 : -1"
              :aria-selected="d.iso === modelValue"
              :aria-current="d.iso === todayISO ? 'date' : undefined"
              :aria-label="d.date.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })"
              class="mx-auto flex h-9 w-9 items-center justify-center rounded-full border text-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900/20"
              :class="[
                d.iso === modelValue
                  ? 'border-neutral-900 bg-neutral-900 font-semibold text-white'
                  : d.inMonth
                    ? 'text-neutral-800 hover:bg-neutral-100'
                    : 'text-neutral-300 hover:bg-neutral-50',
                d.iso === modelValue ? '' : d.iso === todayISO ? 'border-neutral-900 font-semibold text-neutral-900' : 'border-transparent',
              ]"
              @click="pick(d.iso)"
            >
              {{ d.day }}
            </button>
          </div>
        </div>

        <div class="mt-2 flex items-center justify-between border-t border-neutral-100 pt-2">
          <button
            type="button"
            class="rounded-md px-2 py-1 text-sm font-medium text-neutral-700 transition-colors hover:bg-neutral-100 hover:text-neutral-900"
            @click="pick(todayISO)"
          >
            Today
          </button>
          <button
            v-if="modelValue"
            type="button"
            class="rounded-md px-2 py-1 text-sm text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-900"
            @click="clear"
          >
            Clear
          </button>
        </div>
      </div>
    </Teleport>
  </div>
</template>
