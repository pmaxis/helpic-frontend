<script setup lang="ts">
/**
 * The question before an admin changes an account: what it does, a reason
 * for the record, and the admin's two-factor code again — a stolen session
 * can't make a change. A refused code shows under the field, to try again.
 */
import { ref } from 'vue'
import Modal from '@/components/ui/Modal.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseTextarea from '@/components/ui/BaseTextarea.vue'
import TwoFactorCodeInput from '@/components/auth/TwoFactorCodeInput.vue'

const props = defineProps<{
  title: string
  text: string
  confirmLabel: string
  tone: 'danger' | 'primary'
  acting: boolean
  codeError: string
}>()
const emit = defineEmits<{
  confirm: [reason: string, code: string]
  close: []
}>()

const reason = ref('')
const code = ref('')

function close() {
  if (!props.acting) emit('close')
}
</script>

<template>
  <Modal :title="title" @close="close">
    <p class="text-sm leading-relaxed text-neutral-600">{{ text }}</p>
    <div class="mt-4 space-y-4">
      <BaseTextarea v-model="reason" :label="$t('admin.manage.reason')" :placeholder="$t('admin.manage.reasonHint')" :rows="3" />
      <TwoFactorCodeInput v-model="code" :label="$t('admin.manage.code')" :hint="$t('admin.manage.codeHint')" :error="codeError" required />
    </div>
    <template #footer>
      <BaseButton variant="ghost" size="sm" :block="false" :disabled="acting" @click="emit('close')">{{ $t('common.cancel') }}</BaseButton>
      <BaseButton :variant="tone" size="sm" :block="false" :loading="acting" :disabled="acting || !code.trim()" @click="emit('confirm', reason.trim(), code)">
        {{ confirmLabel }}
      </BaseButton>
    </template>
  </Modal>
</template>
