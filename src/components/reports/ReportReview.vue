<script setup lang="ts">
/**
 * The client's say on a sent report: approve it, or ask for changes saying
 * what. What they write goes to the report's discussion; the freelancer then
 * takes the report back to correct it, which starts the review over.
 */
import { computed, ref } from 'vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseTextarea from '@/components/ui/BaseTextarea.vue'
import Modal from '@/components/ui/Modal.vue'
import { useReportsStore } from '@/stores/reports'
import { ApiRequestError } from '@/services/api'
import { toast } from '@/composables/useToasts'
import { t } from '@/i18n'
import type { Report, ReportReview } from '@/types/reports'

const props = defineProps<{ report: Report }>()
const emit = defineEmits<{ changed: [report: Report] }>()

const reports = useReportsStore()
const freelancer = computed(() => props.report.freelancer.name || props.report.freelancer.email)

const saving = ref<ReportReview | null>(null)
const asking = ref(false)
const comment = ref('')
const error = ref('')

async function review(decision: ReportReview, text = '') {
  saving.value = decision
  error.value = ''
  try {
    emit('changed', await reports.reviewReport(props.report.id, decision, text))
    toast.success(decision === 'approved' ? t('reportReview.sentApproved') : t('reportReview.sentChanges'))
    asking.value = false
    comment.value = ''
  } catch (e) {
    const message = e instanceof ApiRequestError ? (Object.values(e.fields ?? {})[0] ?? e.message) : t('reportReview.failed')
    if (asking.value) error.value = message
    else toast.error(message)
  } finally {
    saving.value = null
  }
}

function ask() {
  if (!comment.value.trim()) {
    error.value = t('reportReview.changesRequired')
    return
  }
  void review('changes_requested', comment.value)
}

function onKey(e: KeyboardEvent) {
  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
    e.preventDefault()
    ask()
  }
}
</script>

<template>
  <div class="mt-4">
    <!-- the freelancer kept it as it was: why, before it's reviewed again -->
    <div v-if="report.review_answer && !report.review" class="mb-3 rounded-lg bg-sky-50 p-3 ring-1 ring-sky-600/20 ring-inset">
      <p class="text-xs font-medium text-sky-800">{{ $t('reportReview.answered', { name: freelancer }) }}</p>
      <p class="mt-1 text-sm whitespace-pre-line text-sky-900">“{{ report.review_answer }}”</p>
    </div>
    <p class="text-xs text-neutral-500">{{ $t('reportReview.text', { name: freelancer }) }}</p>
    <div class="mt-2 grid gap-2">
      <BaseButton
        size="sm"
        :variant="report.review === 'approved' ? 'primary' : 'ghost'"
        :loading="saving === 'approved'"
        :disabled="!!saving"
        :aria-pressed="report.review === 'approved'"
        @click="review('approved')"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-4 w-4" aria-hidden="true"><polyline points="20 6 9 17 4 12" /></svg>
        {{ $t('reportReview.approve') }}
      </BaseButton>
      <BaseButton
        size="sm"
        :variant="report.review === 'changes_requested' ? 'primary' : 'ghost'"
        :disabled="!!saving"
        :aria-pressed="report.review === 'changes_requested'"
        @click="asking = true; error = ''"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-4 w-4" aria-hidden="true"><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg>
        {{ $t('reportReview.requestChanges') }}
      </BaseButton>
    </div>
    <p v-if="report.review" class="mt-2 text-xs text-neutral-500">
      {{ report.review === 'approved' ? $t('reportReview.approved') : $t('reportReview.changesRequested') }}
    </p>

    <Modal v-if="asking" :title="$t('reportReview.changesTitle')" @close="asking = false">
      <form id="report-changes" class="space-y-3" novalidate @submit.prevent="ask">
        <p class="text-sm leading-relaxed text-neutral-600">{{ $t('reportReview.changesText', { name: freelancer }) }}</p>
        <BaseTextarea
          v-model="comment"
          :label="$t('reportReview.changesLabel')"
          :placeholder="$t('reportReview.changesPlaceholder')"
          :rows="4"
          :error="error"
          required
          @keydown="onKey"
        />
      </form>
      <template #footer>
        <BaseButton variant="ghost" size="sm" :block="false" :disabled="!!saving" @click="asking = false">{{ $t('common.cancel') }}</BaseButton>
        <BaseButton type="submit" form="report-changes" size="sm" :block="false" :loading="saving === 'changes_requested'" :disabled="!!saving">
          {{ $t('reportReview.send') }}
        </BaseButton>
      </template>
    </Modal>
  </div>
</template>
