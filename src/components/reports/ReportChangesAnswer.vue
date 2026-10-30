<script setup lang="ts">
/**
 * The changes the client asked for, as the freelancer sees them, and their
 * two answers: correct the report (take it back), or keep it as it is,
 * saying why — the client then reviews it again.
 */
import { computed, ref } from 'vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseTextarea from '@/components/ui/BaseTextarea.vue'
import Modal from '@/components/ui/Modal.vue'
import { useReportsStore } from '@/stores/reports'
import { ApiRequestError } from '@/services/api'
import { toast } from '@/composables/useToasts'
import { t } from '@/i18n'
import type { Report } from '@/types/reports'

const props = defineProps<{ report: Report }>()
const emit = defineEmits<{ changed: [report: Report]; correct: [] }>()

const reports = useReportsStore()
const client = computed(() => props.report.client?.name || props.report.client?.email || '')

const keeping = ref(false)
const saving = ref(false)
const comment = ref('')
const error = ref('')

async function keep() {
  if (!comment.value.trim()) {
    error.value = t('report.keepRequired')
    return
  }
  saving.value = true
  error.value = ''
  try {
    emit('changed', await reports.keepReport(props.report.id, comment.value))
    toast.success(t('report.kept'))
    keeping.value = false
    comment.value = ''
  } catch (e) {
    error.value = e instanceof ApiRequestError ? (Object.values(e.fields ?? {})[0] ?? e.message) : t('report.keepFailed')
  } finally {
    saving.value = false
  }
}

function onKey(e: KeyboardEvent) {
  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
    e.preventDefault()
    void keep()
  }
}
</script>

<template>
  <div class="mt-4 rounded-lg bg-amber-50 p-3 ring-1 ring-amber-600/20 ring-inset">
    <p class="text-xs font-medium text-amber-800">{{ $t('report.changesAsked', { name: client }) }}</p>
    <p v-if="report.review_note" class="mt-1 text-sm whitespace-pre-line text-amber-900">“{{ report.review_note }}”</p>
    <div class="mt-3 grid gap-2">
      <BaseButton size="sm" @click="emit('correct')">{{ $t('report.correct') }}</BaseButton>
      <BaseButton variant="ghost" size="sm" @click="keeping = true; error = ''">{{ $t('report.keep') }}</BaseButton>
    </div>

    <Modal v-if="keeping" :title="$t('report.keepTitle')" @close="keeping = false">
      <form id="report-keep" class="space-y-3" novalidate @submit.prevent="keep">
        <p class="text-sm leading-relaxed text-neutral-600">{{ $t('report.keepText', { name: client }) }}</p>
        <BaseTextarea
          v-model="comment"
          :label="$t('report.keepLabel')"
          :placeholder="$t('report.keepPlaceholder')"
          :rows="4"
          :error="error"
          required
          @keydown="onKey"
        />
      </form>
      <template #footer>
        <BaseButton variant="ghost" size="sm" :block="false" :disabled="saving" @click="keeping = false">{{ $t('common.cancel') }}</BaseButton>
        <BaseButton type="submit" form="report-keep" size="sm" :block="false" :loading="saving" :disabled="saving">{{ $t('report.keep') }}</BaseButton>
      </template>
    </Modal>
  </div>
</template>
