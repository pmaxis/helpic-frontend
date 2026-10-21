<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, useAttrs, useId, useSlots, watch } from 'vue'

/**
 * Custom select (button + listbox popover) styled to match the text inputs.
 *
 * Accessibility follows the WAI-ARIA "select-only combobox" pattern: the
 * trigger keeps focus and points at the highlighted option through
 * aria-activedescendant; long lists get a filter box that takes focus instead.
 * Keyboard: ↑/↓, Home/End, Enter/Space to pick, Esc/Tab to close, and
 * type-ahead on the first letters.
 *
 * The panel is teleported to <body> with fixed positioning so it is never
 * clipped by scrolling containers (e.g. modal bodies), and flips upward when
 * there is no room below. It appears with a CSS animation but closes
 * instantly: a Vue leave <Transition> waits on requestAnimationFrame, which
 * stalls in background tabs and would leave an invisible panel eating clicks.
 */
defineOptions({ inheritAttrs: false })

type Option = { value: string; label: string }

const props = withDefaults(
  defineProps<{
    modelValue: string
    options: Option[]
    /** Shown muted while nothing is picked. */
    placeholder?: string
    invalid?: boolean
    disabled?: boolean
    /** Show a filter box in the panel; defaults to on for long lists. */
    searchable?: boolean
    /** "sm" is 32px tall, to line up with small buttons in a toolbar. */
    size?: 'md' | 'sm'
  }>(),
  { searchable: undefined, size: 'md' },
)

const emit = defineEmits<{
  'update:modelValue': [value: string]
  change: [value: string]
}>()

const slots = useSlots()
const attrs = useAttrs()
const uid = useId()
const listboxId = `${uid}-listbox`

// Layout classes size the wrapper; id/aria-* belong on the trigger.
const triggerAttrs = computed(() => {
  const { class: _class, style: _style, ...rest } = attrs
  return rest
})

const trigger = ref<HTMLButtonElement | null>(null)
const panel = ref<HTMLDivElement | null>(null)
const list = ref<HTMLUListElement | null>(null)
const searchInput = ref<HTMLInputElement | null>(null)

const open = ref(false)
const activeIndex = ref(-1)
const query = ref('')
const panelStyle = ref<Record<string, string>>({})
const placement = ref<'bottom' | 'top'>('bottom')

const isSearchable = computed(() => props.searchable ?? props.options.length > 10)
const selected = computed(() => props.options.find((o) => o.value === props.modelValue) ?? null)
const showingPlaceholder = computed(() => !selected.value || (!!props.placeholder && props.modelValue === ''))
const displayLabel = computed(() => (showingPlaceholder.value && props.placeholder ? props.placeholder : selected.value?.label ?? ''))

const filtered = computed(() => {
  const q = query.value.trim().toLowerCase()
  return q ? props.options.filter((o) => o.label.toLowerCase().includes(q)) : props.options
})

const activeId = computed(() =>
  open.value && activeIndex.value >= 0 && activeIndex.value < filtered.value.length
    ? `${uid}-opt-${activeIndex.value}`
    : undefined,
)

// --- positioning ---------------------------------------------------------------

const GAP = 6
const MAX_PANEL = 288

function position() {
  const el = trigger.value
  if (!el) return
  const r = el.getBoundingClientRect()
  const below = window.innerHeight - r.bottom - GAP - 8
  const above = r.top - GAP - 8
  const wanted = Math.min(MAX_PANEL, panel.value?.scrollHeight ?? MAX_PANEL)
  placement.value = below < wanted && above > below ? 'top' : 'bottom'
  const maxHeight = Math.max(120, Math.min(MAX_PANEL, placement.value === 'bottom' ? below : above))
  const width = Math.max(r.width, 192)
  const left = Math.min(r.left, window.innerWidth - width - 8)
  panelStyle.value = {
    position: 'fixed',
    left: `${Math.max(8, left)}px`,
    width: `${width}px`,
    maxHeight: `${maxHeight}px`,
    ...(placement.value === 'bottom'
      ? { top: `${r.bottom + GAP}px` }
      : { bottom: `${window.innerHeight - r.top + GAP}px` }),
  }
}

function onViewportChange(e: Event) {
  // Scrolling inside the panel's own list must not reposition it.
  if (e.type === 'scroll' && panel.value?.contains(e.target as Node)) return
  position()
}

function onPointerDownOutside(e: PointerEvent) {
  const t = e.target as Node
  if (trigger.value?.contains(t) || panel.value?.contains(t)) return
  close(false)
}

watch(open, (isOpen) => {
  if (isOpen) {
    window.addEventListener('scroll', onViewportChange, true)
    window.addEventListener('resize', onViewportChange)
    document.addEventListener('pointerdown', onPointerDownOutside, true)
  } else {
    window.removeEventListener('scroll', onViewportChange, true)
    window.removeEventListener('resize', onViewportChange)
    document.removeEventListener('pointerdown', onPointerDownOutside, true)
  }
})

onBeforeUnmount(() => {
  window.removeEventListener('scroll', onViewportChange, true)
  window.removeEventListener('resize', onViewportChange)
  document.removeEventListener('pointerdown', onPointerDownOutside, true)
})

// --- open / close / pick ----------------------------------------------------------

async function openPanel(highlight: 'selected' | 'first' | 'last' = 'selected') {
  if (props.disabled || open.value) return
  query.value = ''
  open.value = true
  const sel = filtered.value.findIndex((o) => o.value === props.modelValue)
  activeIndex.value =
    highlight === 'last' ? filtered.value.length - 1 : highlight === 'first' || sel < 0 ? 0 : sel
  await nextTick()
  position()
  // Second pass once the panel has its real height (decides flip-up).
  await nextTick()
  position()
  scrollActiveIntoView()
  if (isSearchable.value) searchInput.value?.focus()
}

function close(refocus = true) {
  if (!open.value) return
  open.value = false
  query.value = ''
  if (refocus) trigger.value?.focus()
}

function pick(option: Option) {
  if (option.value !== props.modelValue) {
    emit('update:modelValue', option.value)
    emit('change', option.value)
  }
  close()
}

function toggle() {
  if (open.value) close()
  else void openPanel()
}

function scrollActiveIntoView() {
  nextTick(() => {
    const el = list.value?.querySelector<HTMLElement>(`[data-index="${activeIndex.value}"]`)
    el?.scrollIntoView({ block: 'nearest' })
  })
}

function move(to: number) {
  const n = filtered.value.length
  if (!n) return
  activeIndex.value = Math.max(0, Math.min(n - 1, to))
  scrollActiveIntoView()
}

// --- keyboard ---------------------------------------------------------------------

let typeahead = ''
let typeaheadTimer: number | undefined

function onTypeahead(char: string) {
  typeahead += char.toLowerCase()
  window.clearTimeout(typeaheadTimer)
  typeaheadTimer = window.setTimeout(() => (typeahead = ''), 500)
  const start = typeahead.length === 1 ? activeIndex.value + 1 : activeIndex.value
  const opts = filtered.value
  for (let i = 0; i < opts.length; i++) {
    const idx = (Math.max(0, start) + i) % opts.length
    if (opts[idx].label.toLowerCase().startsWith(typeahead)) {
      if (!open.value) {
        pick(opts[idx])
      } else {
        move(idx)
      }
      return
    }
  }
}

function onKeydown(e: KeyboardEvent) {
  const fromSearch = e.target === searchInput.value
  switch (e.key) {
    case 'ArrowDown':
      e.preventDefault()
      if (!open.value) void openPanel()
      else move(activeIndex.value + 1)
      break
    case 'ArrowUp':
      e.preventDefault()
      if (!open.value) void openPanel()
      else move(activeIndex.value - 1)
      break
    case 'Home':
      if (open.value && !fromSearch) {
        e.preventDefault()
        move(0)
      }
      break
    case 'End':
      if (open.value && !fromSearch) {
        e.preventDefault()
        move(filtered.value.length - 1)
      }
      break
    case 'Enter':
      e.preventDefault()
      if (!open.value) void openPanel()
      else if (filtered.value[activeIndex.value]) pick(filtered.value[activeIndex.value])
      break
    case ' ':
      if (fromSearch) break
      e.preventDefault()
      if (!open.value) void openPanel()
      else if (filtered.value[activeIndex.value]) pick(filtered.value[activeIndex.value])
      break
    case 'Escape':
      if (open.value) {
        // Close just the list, not an enclosing modal.
        e.preventDefault()
        e.stopPropagation()
        close()
      }
      break
    case 'Tab':
      if (open.value) close(fromSearch)
      break
    default:
      if (!fromSearch && e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
        onTypeahead(e.key)
      }
  }
}

watch(query, () => {
  activeIndex.value = filtered.value.length ? 0 : -1
})
</script>

<template>
  <div class="relative" :class="attrs.class" :style="attrs.style as any">
    <button
      ref="trigger"
      v-bind="triggerAttrs"
      type="button"
      role="combobox"
      aria-haspopup="listbox"
      :aria-expanded="open"
      :aria-controls="listboxId"
      :aria-activedescendant="isSearchable ? undefined : activeId"
      :aria-invalid="invalid ? 'true' : undefined"
      :disabled="disabled"
      class="group flex w-full items-center gap-2 rounded-lg border bg-white pr-2.5 pl-3 text-left text-sm shadow-xs transition-colors focus:outline-none focus-visible:outline-none disabled:cursor-not-allowed disabled:bg-neutral-50 disabled:text-neutral-400"
      :class="[
        size === 'sm' ? 'h-8' : 'py-2',
        open
          ? 'border-neutral-900 ring-2 ring-neutral-900/10'
          : invalid
            ? 'border-neutral-900'
            : 'border-neutral-300 hover:border-neutral-400 focus-visible:border-neutral-900 focus-visible:ring-2 focus-visible:ring-neutral-900/10',
      ]"
      @click="toggle"
      @keydown="onKeydown"
    >
      <span
        v-if="slots.icon"
        class="shrink-0 transition-colors"
        :class="open ? 'text-neutral-700' : 'text-neutral-400 group-hover:text-neutral-500'"
        aria-hidden="true"
      >
        <slot name="icon" />
      </span>
      <span class="min-w-0 flex-1 truncate" :class="showingPlaceholder && placeholder ? 'text-neutral-400' : 'text-neutral-900'">
        {{ displayLabel }}
      </span>
      <svg
        viewBox="0 0 20 20"
        fill="none"
        stroke="currentColor"
        stroke-width="1.75"
        stroke-linecap="round"
        stroke-linejoin="round"
        class="h-4 w-4 shrink-0 transition-transform duration-150"
        :class="[open ? 'rotate-180 text-neutral-900' : 'text-neutral-400 group-hover:text-neutral-600']"
        aria-hidden="true"
      >
        <path d="m6 8 4 4 4-4" />
      </svg>
    </button>

    <Teleport to="body">
        <div
          v-if="open"
          ref="panel"
          :style="panelStyle"
          class="z-[60] flex flex-col overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-lg shadow-black/10"
          :class="placement === 'bottom' ? 'animate-pop-down' : 'animate-pop-up'"
        >
          <div v-if="isSearchable" class="shrink-0 border-b border-neutral-100 p-1.5">
            <div class="relative">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="pointer-events-none absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-neutral-400" aria-hidden="true">
                <circle cx="11" cy="11" r="7" />
                <path d="m21 21-4.3-4.3" />
              </svg>
              <input
                ref="searchInput"
                v-model="query"
                type="text"
                role="searchbox"
                :aria-label="$t('ui.filterOptions')"
                :aria-controls="listboxId"
                :aria-activedescendant="activeId"
                :placeholder="$t('ui.search')"
                class="w-full rounded-md bg-neutral-50 py-1.5 pr-2 pl-8 text-sm text-neutral-900 placeholder:text-neutral-400 focus:bg-white focus:ring-1 focus:ring-neutral-200 focus:outline-none"
                @keydown="onKeydown"
              />
            </div>
          </div>

          <ul :id="listboxId" ref="list" role="listbox" tabindex="-1" class="min-h-0 overflow-y-auto overscroll-contain p-1">
            <li
              v-for="(o, i) in filtered"
              :id="`${uid}-opt-${i}`"
              :key="o.value"
              role="option"
              :data-index="i"
              :aria-selected="o.value === modelValue"
              class="flex cursor-pointer items-center gap-2 rounded-md px-2.5 py-1.5 text-sm select-none"
              :class="[
                i === activeIndex ? 'bg-neutral-100 text-neutral-900' : 'text-neutral-700',
                o.value === modelValue ? 'font-medium text-neutral-900' : '',
              ]"
              @pointerenter="activeIndex = i"
              @click="pick(o)"
            >
              <span class="min-w-0 flex-1 truncate">{{ o.label }}</span>
              <svg
                v-if="o.value === modelValue"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2.5"
                stroke-linecap="round"
                stroke-linejoin="round"
                class="h-4 w-4 shrink-0 text-neutral-900"
                aria-hidden="true"
              >
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </li>
            <li v-if="filtered.length === 0" class="px-2.5 py-6 text-center text-sm text-neutral-400" role="presentation">
              {{ $t('ui.nothingMatches', { query }) }}
            </li>
          </ul>
        </div>
    </Teleport>
  </div>
</template>
