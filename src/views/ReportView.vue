<script setup lang="ts">
/**
 * A report as two cards, like the CV editor in Jobic: on the left the report
 * itself — the very PDF that gets downloaded, drawn page by page — and on the
 * right what can be done with it: send, download, and for a draft its title,
 * summary and tasks. Every change re-prints the preview.
 */
import { computed, nextTick, onMounted, ref } from 'vue'
import { z } from 'zod'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import DashboardLayout from '@/layouts/DashboardLayout.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseInput from '@/components/ui/BaseInput.vue'
import BaseTextarea from '@/components/ui/BaseTextarea.vue'
import ConfirmDialog from '@/components/ui/ConfirmDialog.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import NotFoundIllustration from '@/components/illustrations/NotFoundIllustration.vue'
import FormError from '@/components/auth/FormError.vue'
import ActionMenu, { type MenuAction } from '@/components/ui/ActionMenu.vue'
import PdfPreview from '@/components/reports/PdfPreview.vue'
import ReportKindPicker from '@/components/reports/ReportKindPicker.vue'
import ReportHistory from '@/components/reports/ReportHistory.vue'
import { useReportsStore } from '@/stores/reports'
import { ApiRequestError } from '@/services/api'
import { formatDate } from '@/utils/format'
import { formatMoney } from '@/utils/money'
import { pdfFileName, renderReportPdf, savePdf } from '@/utils/reportPdf'
import { toast } from '@/composables/useToasts'
import { useForm } from '@/composables/useForm'
import { LIMITS, optionalText, requiredText } from '@/utils/validation'
import { t } from '@/i18n'
import type { Report, ReportKind } from '@/types/reports'

const reports = useReportsStore()
const route = useRoute()
const router = useRouter()
const id = String(route.params.id)

const report = ref<Report | null>(null)
const notFound = ref(false)

// --- the preview ------------------------------------------------------------------

const pdf = ref<ArrayBuffer | null>(null)
const printing = ref(false)

async function printPreview() {
  if (!report.value) return
  printing.value = true
  try {
    pdf.value = await renderReportPdf(report.value)
  } catch {
    toast.error(t('report.renderFailed'))
  } finally {
    printing.value = false
  }
}

onMounted(async () => {
  try {
    report.value = await reports.fetchReport(id)
  } catch (error) {
    if (error instanceof ApiRequestError && error.status === 404) notFound.value = true
    else toast.error(t('report.loadFailed'))
    return
  }
  syncForm()
  await printPreview()
})

/** Takes a changed report and re-prints the preview. */
/** Bumped on every change, so the history reloads. */
const version = ref(0)

function changed(r: Report) {
  report.value = r
  version.value++
  void printPreview()
}

// --- editing a draft ------------------------------------------------------------------

const form = useForm(
  z.object({ title: requiredText('title', LIMITS.reportTitle), summary: optionalText('summary', LIMITS.reportSummary) }),
  { title: '', summary: '' },
)

function syncForm() {
  if (report.value) form.reset({ title: report.value.title, summary: report.value.summary })
}

const dirty = computed(
  () =>
    !!report.value &&
    (form.values.title.trim() !== report.value.title || form.values.summary.trim() !== report.value.summary),
)

function save() {
  const r = report.value
  if (!r) return
  void form.submit(async (data) => {
    changed(await reports.updateReport(r.id, data))
    syncForm()
  })
}

const switchingKind = ref(false)

/** Switches the type right away, keeping the saved title and summary (unsaved edits stay in the form). */
async function setKind(kind: ReportKind) {
  const r = report.value
  if (!r || r.kind === kind || switchingKind.value) return
  switchingKind.value = true
  try {
    changed(await reports.updateReport(r.id, { title: r.title, summary: r.summary, kind }))
  } catch (error) {
    toast.error(error instanceof ApiRequestError ? error.message : t('report.kindFailed'))
  } finally {
    switchingKind.value = false
  }
}

/** Tasks whose notes field is open; all start folded. */
const openNotes = ref(new Set<string>())

async function toggleNotes(itemId: string) {
  const open = new Set(openNotes.value)
  if (open.has(itemId)) open.delete(itemId)
  else open.add(itemId)
  openNotes.value = open
  if (!open.has(itemId)) return
  await nextTick()
  const field = document.getElementById(`notes-${itemId}`) as HTMLTextAreaElement | null
  field?.focus()
  field?.setSelectionRange(field.value.length, field.value.length)
}

/** First line of the notes, as a hint on the folded toggle. */
function notesPreview(notes: string): string {
  return notes.split('\n').find((l) => l.trim())?.trim() ?? ''
}

/** Saves a task's notes when the field loses focus with a change. */
async function saveNotes(itemId: string, value: string) {
  const r = report.value
  const item = r?.items?.find((it) => it.id === itemId)
  if (!r || !item || value.trim() === item.notes) return
  try {
    changed(await reports.updateItemNotes(r.id, itemId, value))
  } catch (error) {
    toast.error(error instanceof ApiRequestError ? error.message : t('report.notesFailed'))
  }
}

async function removeItem(itemId: string) {
  if (!report.value) return
  try {
    changed(await reports.removeItem(report.value.id, itemId))
  } catch (error) {
    toast.error(error instanceof ApiRequestError ? error.message : t('report.removeFailed'))
  }
}

// --- send, download, delete ------------------------------------------------------------

const confirmSend = ref(false)
const sending = ref(false)
const confirmPaid = ref(false)
const markingPaid = ref(false)

async function markPaid() {
  if (!report.value) return
  markingPaid.value = true
  try {
    changed(await reports.markPaid(report.value.id))
    toast.success(t('report.markedPaid'))
  } catch (error) {
    toast.error(error instanceof ApiRequestError ? error.message : t('report.markPaidFailed'))
  } finally {
    markingPaid.value = false
    confirmPaid.value = false
  }
}

const confirmDelete = ref(false)
/** A draft the client never saw (a personal report is never sent, so it isn't one). */
const isDraft = computed(() => report.value?.status === 'draft' && !!report.value.client)
const deleteText = computed(() => {
  const r = report.value
  if (!r) return ''
  if (isDraft.value) return t('report.deleteDraftText')
  if (r.client) return t('report.deleteSentText', { name: r.client.name || r.client.email })
  return t('report.deletePersonalText')
})
const deleting = ref(false)

async function send() {
  if (!report.value) return
  sending.value = true
  try {
    changed(await reports.sendReport(report.value.id))
    const c = report.value.client
    toast.success(c ? t('report.sentTo', { name: c.name || c.email }) : t('report.sent'))
  } catch (error) {
    toast.error(error instanceof ApiRequestError ? error.message : t('report.sendFailed'))
  } finally {
    sending.value = false
    confirmSend.value = false
  }
}

async function download() {
  const r = report.value
  if (!r) return
  try {
    savePdf(await renderReportPdf(r), pdfFileName(r.title))
  } catch {
    toast.error(t('report.downloadFailed'))
  }
}

async function remove() {
  if (!report.value) return
  deleting.value = true
  try {
    await reports.deleteReport(report.value.id)
    toast.success(t('report.deleted'))
    await router.replace('/reports')
  } catch (error) {
    toast.error(error instanceof ApiRequestError ? error.message : t('report.deleteFailed'))
  } finally {
    deleting.value = false
    confirmDelete.value = false
  }
}

/** Download for everyone; delete for the owner of a draft. */
const actions = computed<MenuAction[]>(() => {
  const r = report.value
  const list: MenuAction[] = []
  if (!r) return list
  list.push({ label: t('report.downloadPdf'), onSelect: () => void download() })
  if (r.can_delete) {
    list.push({ label: isDraft.value ? t('report.deleteDraft') : t('report.deleteReport'), danger: true, onSelect: () => (confirmDelete.value = true) })
  }
  return list
})

const period = computed(() => {
  const r = report.value
  if (!r) return ''
  return r.from === r.to ? formatDate(r.from) : `${formatDate(r.from)} – ${formatDate(r.to)}`
})

const status = computed(() => {
  const r = report.value
  if (!r) return { label: '', tone: '' }
  if (r.status === 'paid') return { label: t('report.statusPaid', { date: r.paid_at ? formatDate(r.paid_at) : '' }), tone: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20' }
  if (r.status === 'sent') return { label: t('report.statusSent', { date: r.sent_at ? formatDate(r.sent_at) : '' }), tone: 'bg-sky-50 text-sky-700 ring-sky-600/20' }
  return { label: r.client ? t('report.statusDraft') : t('report.statusPersonal'), tone: 'bg-neutral-100 text-neutral-600 ring-neutral-500/20' }
})

const card = 'min-h-0 overflow-y-auto rounded-xl border border-neutral-200 bg-white shadow-xs'
</script>

<template>
  <DashboardLayout bare>
    <div class="grid min-h-0 flex-1 gap-4" :class="report ? 'lg:grid-cols-[minmax(0,1fr)_22rem]' : ''">
      <!-- the report, as printed -->
      <section :class="[card, 'flex flex-col']" :aria-label="$t('report.preview')">
        <nav class="flex items-center gap-1.5 px-5 pt-5 text-sm text-neutral-500 sm:px-8 sm:pt-8" :aria-label="$t('report.breadcrumb')">
          <RouterLink
            to="/reports"
            class="-ml-1.5 mr-1 inline-flex h-7 w-7 items-center justify-center rounded-md transition-colors hover:bg-neutral-100 hover:text-neutral-900"
            :aria-label="$t('report.backToReports')"
            :title="$t('report.backToReports')"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-4 w-4" aria-hidden="true">
              <path d="M19 12H5" />
              <polyline points="12 19 5 12 12 5" />
            </svg>
          </RouterLink>
          <RouterLink to="/reports" class="hover:text-neutral-900">{{ $t('reports.title') }}</RouterLink>
          <template v-if="report">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-3.5 w-3.5 text-neutral-300" aria-hidden="true">
              <polyline points="9 18 15 12 9 6" />
            </svg>
            <span class="truncate text-neutral-700">{{ report.title }}</span>
          </template>
        </nav>

        <div v-if="notFound" class="flex min-h-0 flex-1 flex-col p-5 sm:p-8">
          <EmptyState class="flex-1 justify-center" :title="$t('report.notFound')" :description="$t('report.notFoundText')">
            <template #illustration>
              <NotFoundIllustration />
            </template>
          </EmptyState>
        </div>
        <!-- grows with the pages, so the card scrolls them with the bottom padding after the last one -->
        <div v-else class="relative px-5 pt-5 pb-5 sm:px-8 sm:pb-8">
          <div class="mx-auto max-w-[210mm]" :class="printing && pdf ? 'opacity-60 transition-opacity' : ''">
            <PdfPreview v-if="pdf" :data="pdf" />
            <div v-else class="flex aspect-[210/297] items-center justify-center rounded-sm bg-neutral-50 ring-1 ring-neutral-200">
              <span class="text-sm text-neutral-400">{{ $t('report.preparing') }}</span>
            </div>
          </div>
        </div>
      </section>

      <!-- what can be done with it -->
      <aside v-if="report" :class="card" aria-labelledby="report-panel">
        <div class="border-b border-neutral-200 px-5 py-4">
          <div class="flex items-center justify-between gap-2">
            <h2 id="report-panel" class="text-sm font-semibold text-neutral-900">{{ $t('report.panel') }}</h2>
            <ActionMenu v-if="actions.length" :actions="actions" :label="$t('report.options')" />
          </div>
          <span class="mt-2 inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset" :class="status.tone">
            {{ status.label }}
          </span>
          <div v-if="report.can_edit && report.client" class="mt-4">
            <BaseButton
              size="sm"
              :disabled="!report.items?.length"
              :title="report.items?.length ? undefined : $t('report.nothingToSend')"
              @click="confirmSend = true"
            >
              {{ $t('report.sendTo', { name: report.client.name || report.client.email }) }}
            </BaseButton>
          </div>
          <div v-if="report.can_mark_paid" class="mt-4">
            <BaseButton size="sm" @click="confirmPaid = true">{{ $t('report.markPaid') }}</BaseButton>
          </div>
        </div>

        <dl class="grid grid-cols-[5.5rem_minmax(0,1fr)] gap-x-3 gap-y-2.5 border-b border-neutral-200 px-5 py-4 text-sm">
          <dt class="text-neutral-500">{{ report.client ? $t('report.client') : $t('report.for') }}</dt>
          <dd class="truncate text-neutral-800">{{ report.client ? report.client.name || report.client.email : $t('report.personalWork') }}</dd>
          <dt class="text-neutral-500">{{ $t('report.period') }}</dt>
          <dd class="text-neutral-800">{{ period }}</dd>
          <dt class="text-neutral-500">{{ report.projects.length > 1 ? $t('report.projects') : $t('report.project') }}</dt>
          <dd class="text-neutral-800" :class="report.projects.length > 1 ? 'break-words' : 'truncate'">{{ report.projects.map((p) => p.name).join(', ') || $t('report.allProjects') }}</dd>
          <template v-if="!report.can_edit">
            <dt class="text-neutral-500">{{ $t('report.type') }}</dt>
            <dd class="text-neutral-800">{{ report.kind === 'detailed' ? $t('report.detailed') : $t('report.basic') }}</dd>
          </template>
          <dt class="text-neutral-500">{{ $t('report.tasks') }}</dt>
          <dd class="text-neutral-800">{{ report.items?.length ?? report.item_count }}</dd>
          <template v-if="report.total_cents !== null">
            <dt class="text-neutral-500">{{ $t('report.total') }}</dt>
            <dd class="font-semibold text-neutral-900">{{ formatMoney(report.total_cents, report.currency) }}</dd>
          </template>
        </dl>

        <template v-if="report.can_edit">
          <div class="border-b border-neutral-200 px-5 py-4">
            <p class="text-sm font-medium text-neutral-700">{{ $t('report.type') }}</p>
            <ReportKindPicker :model-value="report.kind" :disabled="switchingKind" compact class="mt-2" @update:model-value="setKind" />
          </div>

          <form class="space-y-4 border-b border-neutral-200 px-5 py-4" novalidate @submit.prevent="save">
            <FormError :message="form.formError" />
            <BaseInput v-bind="form.field('title')" :label="$t('report.title')" />
            <BaseTextarea v-bind="form.field('summary')" :label="$t('report.summary')" :placeholder="$t('report.summaryPlaceholder')" :rows="5" />
            <div class="flex justify-end gap-2">
              <BaseButton v-if="dirty" variant="ghost" size="sm" :block="false" :disabled="form.submitting" @click="syncForm">{{ $t('common.reset') }}</BaseButton>
              <BaseButton type="submit" size="sm" :block="false" :loading="form.submitting" :disabled="form.submitting || !dirty">{{ $t('common.save') }}</BaseButton>
            </div>
          </form>

          <section class="px-5 py-4" aria-labelledby="report-tasks">
            <h3 id="report-tasks" class="text-xs font-semibold tracking-wide text-neutral-500 uppercase">{{ $t('report.tasksInReport') }}</h3>
            <p v-if="report.items?.length" class="mt-1 text-xs text-neutral-400">
              {{ report.client ? $t('report.pricesUntilSent') : $t('report.pricesFromTasks') }}
            </p>
            <p v-if="!report.items?.length" class="mt-2 text-sm text-neutral-400">
              {{ report.client ? $t('report.noTasksForClient') : $t('report.noTasks') }}
            </p>
            <ul v-else class="mt-2 divide-y divide-neutral-100">
              <li v-for="it in report.items" :key="it.id" class="py-2">
                <div class="group flex items-start gap-2">
                  <div class="min-w-0 flex-1">
                    <p class="truncate text-sm text-neutral-800">{{ it.title }}</p>
                    <p class="text-xs text-neutral-400">{{ formatDate(it.completed_on) }}{{ it.project_name ? ` · ${it.project_name}` : '' }}</p>
                  </div>
                  <span v-if="it.price_cents !== null" class="shrink-0 pt-px text-sm text-neutral-800 tabular-nums">
                    {{ formatMoney(it.price_cents, report.currency) }}
                  </span>
                  <span v-else-if="report.total_cents !== null" class="shrink-0 pt-px text-xs text-neutral-400">{{ $t('report.noPrice') }}</span>
                  <button
                    type="button"
                    class="shrink-0 rounded-md p-1 text-neutral-300 transition hover:bg-neutral-100 hover:text-neutral-700"
                    :aria-label="$t('report.removeTask', { title: it.title })"
                    :title="$t('report.removeFromReport')"
                    @click="removeItem(it.id)"
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-4 w-4">
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                </div>

                <!-- the task's notes, folded until asked for; full width under the row -->
                <div v-if="report.kind === 'detailed'" class="mt-1">
                  <button
                    type="button"
                    class="-mx-1 flex w-[calc(100%+0.5rem)] min-w-0 items-center gap-1 rounded-md px-1 py-0.5 text-left text-xs transition-colors hover:bg-neutral-100"
                    :aria-expanded="openNotes.has(it.id)"
                    :aria-controls="`notes-${it.id}`"
                    @click="toggleNotes(it.id)"
                  >
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      class="h-3 w-3 shrink-0 text-neutral-400 transition-transform"
                      :class="openNotes.has(it.id) ? 'rotate-90' : ''"
                      aria-hidden="true"
                    >
                      <polyline points="9 18 15 12 9 6" />
                    </svg>
                    <span class="shrink-0 font-medium text-neutral-600">{{ $t('report.notes') }}</span>
                    <span v-if="!openNotes.has(it.id)" class="min-w-0 truncate text-neutral-400">
                      {{ notesPreview(it.notes) || $t('report.notesEmpty') }}
                    </span>
                  </button>
                  <template v-if="openNotes.has(it.id)">
                    <label :for="`notes-${it.id}`" class="sr-only">{{ $t('report.notesFor', { title: it.title }) }}</label>
                    <textarea
                      :id="`notes-${it.id}`"
                      :value="it.notes"
                      rows="4"
                      class="mt-1 block w-full resize-y rounded-md border border-neutral-200 bg-white px-2 py-1.5 text-xs leading-relaxed text-neutral-800 focus:border-neutral-900 focus:ring-2 focus:ring-neutral-900/10 focus:outline-none"
                      @change="saveNotes(it.id, ($event.target as HTMLTextAreaElement).value)"
                    />
                  </template>
                </div>
              </li>
            </ul>
          </section>
        </template>

        <ReportHistory :report-id="report.id" :version="version" />
      </aside>
    </div>

    <ConfirmDialog
      v-model:open="confirmSend"
      :title="$t('report.confirmSend')"
      :description="$t('report.confirmSendText', { name: report?.client?.name || report?.client?.email })"
      :confirm-label="$t('report.send')"
      tone="primary"
      :loading="sending"
      @confirm="send"
    />
    <ConfirmDialog
      v-model:open="confirmPaid"
      :title="$t('report.confirmPaid')"
      :description="$t('report.confirmPaidText', { name: report?.freelancer.name || report?.freelancer.email })"
      :confirm-label="$t('report.markPaid')"
      tone="primary"
      :loading="markingPaid"
      @confirm="markPaid"
    />
    <ConfirmDialog
      v-model:open="confirmDelete"
      :title="isDraft ? $t('report.confirmDeleteDraft') : $t('report.confirmDelete')"
      :description="deleteText"
      :loading="deleting"
      @confirm="remove"
    />
  </DashboardLayout>
</template>
