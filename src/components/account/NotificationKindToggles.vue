<script setup lang="ts">
/**
 * A switch per kind of notification, in groups, showing only what this user
 * can get. Folds into one line ("9 of 13 on"); whether it's open is
 * remembered in this browser. The default slot explains the channel.
 */
import { computed, ref, useId, watch } from 'vue'
import ToggleSwitch from '@/components/ui/ToggleSwitch.vue'
import { useAuthStore } from '@/stores/auth'
import { NOTIFICATION_GROUPS, type NotificationKindInfo } from '@/constants/notifications'
import type { NotificationKind } from '@/types/notifications'

const props = defineProps<{
  /** The kinds the channel offers. */
  available: NotificationKind[]
  /** The kinds switched on. */
  selected: NotificationKind[]
  /** The fold's heading, e.g. "What gets emailed". */
  title: string
  /** Remembers whether it's open, per channel. */
  storageKey: string
}>()

const emit = defineEmits<{ toggle: [kind: NotificationKind, on: boolean] }>()

const auth = useAuthStore()

function fits(k: NotificationKindInfo): boolean {
  if (k.for === 'freelancer') return auth.isFreelancer
  if (k.for === 'owner') return auth.isTeamOwner
  if (k.for === 'client') return auth.isClient
  return true
}

const contentId = useId()
const key = `helpic:notification-kinds-open:${props.storageKey}`

function readOpen(): boolean {
  try {
    return localStorage.getItem(key) === '1'
  } catch {
    return false
  }
}
const open = ref(readOpen())
watch(open, (value) => {
  try {
    localStorage.setItem(key, value ? '1' : '0')
  } catch {
    // storage may be unavailable (private mode); the choice then lasts for this visit
  }
})

const groups = computed(() =>
  NOTIFICATION_GROUPS.map((g) => ({ ...g, kinds: g.kinds.filter((k) => props.available.includes(k.kind) && fits(k)) })).filter(
    (g) => g.kinds.length,
  ),
)

/** Counted over what this user can get, not every kind there is. */
const visible = computed(() => groups.value.flatMap((g) => g.kinds.map((k) => k.kind)))
const total = computed(() => visible.value.length)
const onCount = computed(() => visible.value.filter((k) => props.selected.includes(k)).length)
</script>

<template>
  <div>
    <button
      type="button"
      class="-mx-2 flex w-[calc(100%+1rem)] items-center justify-between gap-3 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-neutral-50"
      :aria-expanded="open"
      :aria-controls="contentId"
      @click="open = !open"
    >
      <span class="text-sm font-medium text-neutral-900">{{ title }}</span>
      <span class="flex shrink-0 items-center gap-2 text-xs text-neutral-500">
        {{ $t('notificationSettings.onOf', { on: onCount, total }) }}
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          class="h-4 w-4 text-neutral-400 transition-transform"
          :class="open ? 'rotate-180' : ''"
          aria-hidden="true"
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </span>
    </button>

    <div v-show="open" :id="contentId" class="pt-2">
      <p v-if="$slots.default" class="text-xs text-neutral-500"><slot /></p>
      <div class="mt-3 grid gap-x-8 gap-y-5 sm:grid-cols-2">
        <div v-for="g in groups" :key="g.group">
          <p class="text-xs font-medium tracking-wide text-neutral-400 uppercase">{{ $t(`notificationKinds.groups.${g.group}`) }}</p>
          <ul class="mt-1.5">
            <li v-for="k in g.kinds" :key="k.kind" class="flex items-center justify-between gap-3 py-1.5">
              <span class="text-sm text-neutral-700">{{ $t(`notificationKinds.${k.kind}`) }}</span>
              <ToggleSwitch
                :model-value="selected.includes(k.kind)"
                :label="$t(`notificationKinds.${k.kind}`)"
                @update:model-value="emit('toggle', k.kind, $event)"
              />
            </li>
          </ul>
        </div>
      </div>
    </div>
  </div>
</template>
