<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
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
import { ApiRequestError } from '@/services/api'
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

// This month so far, by default.
const form = reactive({
  client_id: '',
  /** None picked covers all the client's projects. */
  project_ids: [] as string[],
  from: iso(new Date(today.getFullYear(), today.getMonth(), 1)),
  to: iso(today),
  title: '',
  summary: '',
  kind: 'basic' as ReportKind,
})

const fieldErrors = reactive<Record<string, string>>({})
const formError = ref('')
const saving = ref(false)

onMounted(() => {
  void people.fetchClients().then(() => {
    if (people.clients.length === 1) form.client_id = people.clients[0].id
  })
  if (!projects.loaded) void projects.fetchProjects().catch(() => {})
})

// No client: a report on personal work, made to be downloaded.
const clientOptions = computed(() => [
  { value: '', label: 'No client — personal work' },
  ...people.clients.map((c) => ({ value: c.id, label: c.name || c.email })),
])
const projectOptions = computed(() =>
  projects.projects.filter((p) => (p.client?.id ?? '') === form.client_id).map((p) => ({ value: p.id, label: p.name })),
)
watch(
  () => form.client_id,
  () => (form.project_ids = []),
)

async function submit() {
  for (const k of Object.keys(fieldErrors)) fieldErrors[k] = ''
  formError.value = ''
  if (!form.from) fieldErrors.from = 'Choose the first day'
  if (!form.to) fieldErrors.to = 'Choose the last day'
  if (Object.values(fieldErrors).some(Boolean)) return

  saving.value = true
  try {
    const report = await reports.createReport({
      client_id: form.client_id || undefined,
      project_ids: form.project_ids.length ? form.project_ids : undefined,
      from: form.from,
      to: form.to,
      title: form.title.trim() || undefined,
      summary: form.summary.trim() || undefined,
      kind: form.kind,
    })
    emit('created', report)
  } catch (error) {
    if (error instanceof ApiRequestError) {
      if (error.fields) Object.assign(fieldErrors, error.fields)
      formError.value = error.fields ? '' : error.message
    } else {
      formError.value = 'Something went wrong. Please try again.'
    }
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <Modal title="New report" size="lg" @close="emit('close')">
    <form class="space-y-4" novalidate @submit.prevent="submit">
      <FormError :message="formError" />
      <p class="text-sm text-neutral-500">
        <template v-if="form.client_id">The report lists the tasks you finished for the client in this period. You can review it before sending.</template>
        <template v-else>A report on your personal work — the tasks you finished in this period. You can download it as PDF.</template>
      </p>
      <div class="grid gap-4 sm:grid-cols-2">
        <BaseSelect v-model="form.client_id" label="Client" :options="clientOptions" :error="fieldErrors.client_id" />
        <MultiSelectInput
          v-model="form.project_ids"
          label="Projects"
          placeholder="All projects"
          :options="projectOptions"
          :error="fieldErrors.project_ids"
        />
        <DateInput v-model="form.from" label="From" :error="fieldErrors.from" />
        <DateInput v-model="form.to" label="To" :error="fieldErrors.to" />
      </div>
      <fieldset>
        <legend class="text-sm font-medium text-neutral-700">Type</legend>
        <ReportKindPicker v-model="form.kind" inline class="mt-1.5" />
      </fieldset>
      <BaseInput v-model="form.title" label="Title" placeholder="Named after the period if left empty" :error="fieldErrors.title" />
      <BaseTextarea
        v-model="form.summary"
        label="Summary"
        placeholder="Highlights, what's next…"
        :rows="4"
        :error="fieldErrors.summary"
      />
    </form>

    <template #footer>
      <BaseButton variant="ghost" size="sm" :block="false" :disabled="saving" @click="emit('close')">Cancel</BaseButton>
      <BaseButton size="sm" :block="false" :loading="saving" :disabled="saving" @click="submit">
        {{ form.client_id ? 'Create draft' : 'Create report' }}
      </BaseButton>
    </template>
  </Modal>
</template>
