<script setup lang="ts">
/**
 * The task's public link: whoever opens it reads the task, its subtasks and
 * its files without an account — not the people, the price, the time or the
 * comments. Its creator or its freelancer turns it on, copies it, and turns
 * it off; turned on again, it's a new address.
 */
import { onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import Modal from '@/components/ui/Modal.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import { getTaskShare, shareTask, unshareTask } from '@/services/shares'
import { toast } from '@/composables/useToasts'
import { formatDate } from '@/utils/format'
import type { TaskShare } from '@/types/shares'

const props = defineProps<{ taskId: string }>()
const emit = defineEmits<{ close: [] }>()

const { t } = useI18n()

const share = ref<TaskShare | null>(null)
const loading = ref(true)
const busy = ref(false)

onMounted(async () => {
  try {
    share.value = await getTaskShare(props.taskId)
  } catch {
    toast.error(t('share.loadFailed'))
    emit('close')
    return
  }
  loading.value = false
})

async function turnOn() {
  busy.value = true
  try {
    share.value = await shareTask(props.taskId)
    await copy()
  } catch {
    toast.error(t('share.createFailed'))
  } finally {
    busy.value = false
  }
}

async function turnOff() {
  busy.value = true
  try {
    await unshareTask(props.taskId)
    share.value = null
    toast.success(t('share.turnedOff'))
  } catch {
    toast.error(t('share.turnOffFailed'))
  } finally {
    busy.value = false
  }
}

async function copy() {
  if (!share.value) return
  try {
    await navigator.clipboard.writeText(share.value.url)
    toast.success(t('share.copied'))
  } catch {
    toast.error(t('share.copyFailed'))
  }
}

/** A click in the field selects the whole link, to copy it by hand. */
function selectAll(e: FocusEvent) {
  const field = e.target as HTMLInputElement
  field.select()
}
</script>

<template>
  <Modal :title="$t('share.title')" @close="$emit('close')">
    <div v-if="loading" class="space-y-3" aria-hidden="true">
      <div class="h-3.5 w-full animate-pulse rounded bg-neutral-200/70" />
      <div class="h-9 w-full animate-pulse rounded-lg bg-neutral-200/70" />
    </div>
    <template v-else>
      <p class="text-sm leading-6 text-neutral-600">{{ $t('share.explain') }}</p>

      <div v-if="share" class="mt-4">
        <label for="task-share-url" class="sr-only">{{ $t('share.link') }}</label>
        <div class="flex gap-2">
          <input
            id="task-share-url"
            :value="share.url"
            readonly
            class="block h-9 min-w-0 flex-1 rounded-lg border border-neutral-300 bg-neutral-50 px-3 text-sm text-neutral-800 focus:border-neutral-900 focus:ring-2 focus:ring-neutral-900/10 focus:outline-none"
            @focus="selectAll"
          />
          <BaseButton size="sm" :block="false" @click="copy">{{ $t('share.copy') }}</BaseButton>
        </div>
        <p class="mt-2 text-xs text-neutral-500">{{ $t('share.since', { date: formatDate(share.created_at) }) }}</p>
      </div>
    </template>

    <template v-if="!loading" #footer>
      <BaseButton v-if="share" variant="danger" size="sm" :block="false" :loading="busy" @click="turnOff">{{ $t('share.turnOff') }}</BaseButton>
      <BaseButton v-else size="sm" :block="false" :loading="busy" @click="turnOn">{{ $t('share.turnOn') }}</BaseButton>
    </template>
  </Modal>
</template>
