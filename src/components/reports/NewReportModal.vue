<script setup lang="ts">
import { computed, onMounted, watch } from 'vue'
import { z } from 'zod'
import Modal from '@/components/ui/Modal.vue'
import BaseInput from '@/components/ui/BaseInput.vue'
import BaseTextarea from '@/components/ui/BaseTextarea.vue'
import BaseSelect from '@/components/ui/BaseSelect.vue'
import MultiSelectInput from '@/components/ui/MultiSelectInput.vue'
import DateInput from '@/components/ui/DateInput.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import FormError from '@/components/auth/FormError.vue'
import ReportKindPicker from '@/components/reports/ReportKindPicker.vue'
import { usePeopleStore } from '@/stores/people'
import { useProjectsStore } from '@/stores/projects'
import { useReportsStore } from '@/stores/reports'
import { useForm } from '@/composables/useForm'
import { across, choice, daysBetween, LIMITS, optionalText } from '@/utils/validation'
import { t } from '@/i18n'
import type { Report, ReportKind } from '@/types/reports'

const emit = defineEmits<{
  close: []
  created: [report: Report]
}>()

const people = usePeopleStore()
const projects = useProjectsStore()
const reports = useReportsStore()

function iso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
const today = new Date()

const schema = z
  .object({
    client_id: z.string(),
    /** None picked covers all the client's projects. */
    project_ids: z.array(z.string()),
    from: choice(() => t('validation.chooseFirstDay')),
    to: choice(() => t('validation.chooseLastDay')),
    title: optionalText('title', LIMITS.reportTitle),
    summary: optionalText('summary', LIMITS.reportSummary),
    kind: z.string(),
  })
  .refine(...across('to', (v) => !v.from || !v.to || v.to >= v.from, () => t('validation.periodEndsBeforeStart')))
  .refine(
    ...across('to', (v) => !v.from || !v.to || daysBetween(String(v.from), String(v.to)) <= LIMITS.reportDays, () => t('validation.periodTooLong')),
  )

// This month so far, by default.
const form = useForm(schema, {
  client_id: '',
  project_ids: [],
  from: iso(new Date(today.getFullYear(), today.getMonth(), 1)),
  to: iso(today),
  title: '',
  summary: '',
  kind: 'basic',
})

onMounted(() => {
  void people.fetchClients().then(() => {
    if (people.clients.length === 1) form.values.client_id = people.clients[0].id
  })
  if (!projects.loaded) void projects.fetchProjects().catch(() => {})
})

// No client: a report on personal work, made to be downloaded.
const clientOptions = computed(() => [
  { value: '', label: t('newReport.noClient') },
  ...people.clients.map((c) => ({ value: c.id, label: c.name || c.email })),
])
const projectOptions = computed(() =>
  projects.projects.filter((p) => (p.client?.id ?? '') === form.values.client_id).map((p) => ({ value: p.id, label: p.name })),
)
watch(
  () => form.values.client_id,
  () => (form.values.project_ids = []),
)

function submit() {
  void form.submit(async (data) => {
    const report = await reports.createReport({
      client_id: data.client_id || undefined,
      project_ids: data.project_ids.length ? data.project_ids : undefined,
      from: data.from,
      to: data.to,
      title: data.title || undefined,
      summary: data.summary || undefined,
      kind: data.kind as ReportKind,
    })
    emit('created', report)
  })
}
</script>

<template>
  <Modal :title="$t('newReport.title')" size="lg" @close="emit('close')">
    <form class="space-y-4" novalidate @submit.prevent="submit">
      <FormError :message="form.formError" />
      <p class="text-sm text-neutral-500">
        <template v-if="form.values.client_id">{{ $t('newReport.forClient') }}</template>
        <template v-else>{{ $t('newReport.personal') }}</template>
      </p>
      <div class="grid gap-4 sm:grid-cols-2">
        <BaseSelect v-bind="form.field('client_id')" :label="$t('newReport.client')" :options="clientOptions" />
        <MultiSelectInput
          v-bind="form.field('project_ids')"
          :label="$t('newReport.projects')"
          :placeholder="$t('newReport.allProjects')"
          :options="projectOptions"
        />
        <DateInput v-bind="form.field('from')" :label="$t('newReport.from')" />
        <DateInput v-bind="form.field('to')" :label="$t('newReport.to')" />
      </div>
      <fieldset>
        <legend class="text-sm font-medium text-neutral-700">{{ $t('newReport.type') }}</legend>
        <ReportKindPicker
          :model-value="form.values.kind as ReportKind"
          inline
          class="mt-1.5"
          @update:model-value="form.values.kind = $event"
        />
      </fieldset>
      <BaseInput v-bind="form.field('title')" :label="$t('newReport.titleLabel')" :placeholder="$t('newReport.titlePlaceholder')" />
      <BaseTextarea v-bind="form.field('summary')" :label="$t('newReport.summary')" :placeholder="$t('newReport.summaryPlaceholder')" :rows="4" />
    </form>

    <template #footer>
      <BaseButton variant="ghost" size="sm" :block="false" :disabled="form.submitting" @click="emit('close')">{{ $t('common.cancel') }}</BaseButton>
      <BaseButton size="sm" :block="false" :loading="form.submitting" :disabled="form.submitting" @click="submit">
        {{ form.values.client_id ? $t('newReport.createDraft') : $t('newReport.create') }}
      </BaseButton>
    </template>
  </Modal>
</template>
