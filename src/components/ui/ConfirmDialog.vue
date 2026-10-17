<script setup lang="ts">
import Modal from '@/components/ui/Modal.vue'
import BaseButton from '@/components/ui/BaseButton.vue'

const props = withDefaults(
  defineProps<{
    open: boolean
    title: string
    description: string
    confirmLabel?: string
    cancelLabel?: string
    loading?: boolean
    /** "danger" (red) for destructive actions, "primary" for the rest. */
    tone?: 'danger' | 'primary'
  }>(),
  { confirmLabel: undefined, cancelLabel: undefined, loading: false, tone: 'danger' },
)

const emit = defineEmits<{
  'update:open': [value: boolean]
  confirm: []
}>()

function close() {
  if (!props.loading) emit('update:open', false)
}
</script>

<template>
  <Modal v-if="open" :title="title" @close="close">
    <p class="text-sm leading-relaxed text-neutral-600">{{ description }}</p>

    <template #footer>
      <BaseButton variant="ghost" size="sm" :block="false" :disabled="loading" @click="close">
        {{ cancelLabel ?? $t('common.cancel') }}
      </BaseButton>
      <BaseButton
        :variant="tone"
        size="sm"
        :block="false"
        :loading="loading"
        :disabled="loading"
        @click="emit('confirm')"
      >
        {{ confirmLabel ?? $t('common.delete') }}
      </BaseButton>
    </template>
  </Modal>
</template>
