<script setup lang="ts">
/**
 * Dictation's own screen, over the form: what's heard gathers here, showing
 * where it will go, and the form takes it all at once on Done. So the fields
 * and the dialog hold still while someone talks, and Cancel leaves no trace.
 */
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import { useDictation } from '@/composables/useDictation'

const props = defineProps<{
  /** The form has a title already, so everything said is description. */
  titled: boolean
}>()
const emit = defineEmits<{ done: [phrases: string[]]; cancel: [] }>()

const phrases = ref<string[]>([])
const finishing = ref(false)
const dictation = useDictation((phrase) => phrases.value.push(phrase))
const { listening, heard, error } = dictation

const title = computed(() => (props.titled ? '' : (phrases.value[0] ?? '')))
const details = computed(() => (props.titled ? phrases.value : phrases.value.slice(1)))

const log = ref<HTMLElement | null>(null)
const doneButton = ref<InstanceType<typeof BaseButton> | null>(null)

onMounted(() => {
  dictation.start()
  ;(doneButton.value?.$el as HTMLElement | undefined)?.focus()
})

/** Asks for the end of the speech: its last phrase arrives before recognition stops. */
function finish() {
  if (!listening.value) {
    emit('done', phrases.value)
    return
  }
  finishing.value = true
  dictation.stop()
}

watch(listening, (on) => {
  if (!on && finishing.value) emit('done', phrases.value)
})

// The newest words stay in view.
watch([() => phrases.value.length, heard], async () => {
  await nextTick()
  log.value?.scrollTo({ top: log.value.scrollHeight })
})
</script>

<template>
  <!-- covers the whole dialog, so it's the same size and nothing moves; Escape leaves dictation, not the form -->
  <div class="absolute inset-0 z-10 flex flex-col rounded-xl bg-white" role="group" :aria-label="$t('dictation.title')" @keydown.esc.stop="emit('cancel')">
    <div class="flex shrink-0 items-center justify-between gap-3 border-b border-neutral-200 px-5 py-4">
      <h2 class="min-w-0 truncate text-sm font-semibold text-neutral-900">{{ $t('dictation.title') }}</h2>
      <span class="flex h-7 shrink-0 items-center gap-2 text-sm text-neutral-500" aria-live="polite">
        <span class="h-2 w-2 rounded-full" :class="listening ? 'animate-pulse bg-red-500' : 'bg-neutral-300'" aria-hidden="true" />
        {{ listening ? $t('dictation.listening') : $t('dictation.paused') }}
      </span>
    </div>

    <div ref="log" class="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4 text-sm">
      <p v-if="error" class="text-neutral-600" role="alert">{{ error === 'denied' ? $t('dictation.denied') : $t('dictation.failed') }}</p>
      <div v-if="title">
        <p class="text-xs text-neutral-500">{{ $t('task.titleLabel') }}</p>
        <p class="mt-1 font-medium text-neutral-900">{{ title }}</p>
      </div>
      <div v-if="details.length">
        <p class="text-xs text-neutral-500">{{ $t('task.description') }}</p>
        <p v-for="(phrase, i) in details" :key="i" class="mt-1 text-neutral-900">{{ phrase }}</p>
      </div>
      <p v-if="heard" class="text-neutral-400">{{ heard }}</p>
      <div v-else-if="!phrases.length && !error" class="flex h-full flex-col items-center justify-center gap-3 text-center text-neutral-500">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="h-8 w-8 text-neutral-400" aria-hidden="true">
          <rect x="9" y="3" width="6" height="11" rx="3" />
          <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
        </svg>
        <p>{{ titled ? $t('dictation.hintDetails') : $t('dictation.hint') }}</p>
      </div>
    </div>

    <div class="flex shrink-0 items-center gap-2 border-t border-neutral-100 px-5 py-4">
      <BaseButton class="mr-auto" variant="ghost" size="sm" :block="false" :disabled="finishing" @click="dictation.toggle()">
        {{ listening ? $t('dictation.pause') : $t('dictation.resume') }}
      </BaseButton>
      <BaseButton variant="ghost" size="sm" :block="false" @click="emit('cancel')">{{ $t('common.cancel') }}</BaseButton>
      <BaseButton ref="doneButton" size="sm" :block="false" :loading="finishing" @click="finish">{{ $t('dictation.done') }}</BaseButton>
    </div>
  </div>
</template>
