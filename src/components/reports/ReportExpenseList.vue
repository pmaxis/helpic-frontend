<script setup lang="ts">
/**
 * What the work cost, in a draft report: hosting, licences, a subcontractor.
 * Each is a line of the freelancer's own, not a task's, so it's written here:
 * what it was, the day and the amount, added to the report's total.
 */
import { computed, ref } from 'vue'
import { z } from 'zod'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseInput from '@/components/ui/BaseInput.vue'
import DateInput from '@/components/ui/DateInput.vue'
import FormError from '@/components/auth/FormError.vue'
import { useForm } from '@/composables/useForm'
import { toast } from '@/composables/useToasts'
import { useReportsStore } from '@/stores/reports'
import { ApiRequestError } from '@/services/api'
import { formatDate } from '@/utils/format'
import { formatMoney, priceInput } from '@/utils/money'
import { choice, LIMITS, price, requiredText } from '@/utils/validation'
import { t } from '@/i18n'
import type { Report, ReportItem } from '@/types/reports'

const props = defineProps<{ report: Report }>()
const emit = defineEmits<{
  /** The report as the server has it after a change here. */
  changed: [report: Report]
}>()

const reports = useReportsStore()

const expenses = computed(() => (props.report.items ?? []).filter((it) => it.expense))

const form = useForm(
  z.object({
    title: requiredText('title', LIMITS.reportTitle),
    spent_on: choice(() => t('report.expenseDateRequired')),
    amount: price().refine((v) => /[1-9]/.test(v), { error: () => t('report.expenseAmountRequired') }),
  }),
  { title: '', spent_on: '', amount: '' },
)

/** The form is open on a new expense, or on the line with this ID. */
const editing = ref<'new' | string | null>(null)

function startAdding() {
  form.reset({ title: '', spent_on: props.report.to, amount: '' })
  editing.value = 'new'
}

function startEditing(it: ReportItem) {
  form.reset({ title: it.title, spent_on: it.completed_on, amount: priceInput(it.price_cents) })
  editing.value = it.id
}

function save() {
  const id = editing.value
  if (!id) return
  void form.submit(async (data) => {
    const report = id === 'new' ? await reports.addExpense(props.report.id, data) : await reports.updateExpense(props.report.id, id, data)
    emit('changed', report)
    editing.value = null
  })
}

async function remove(it: ReportItem) {
  try {
    emit('changed', await reports.removeItem(props.report.id, it.id))
    if (editing.value === it.id) editing.value = null
  } catch (error) {
    toast.error(error instanceof ApiRequestError ? error.message : t('report.expenseRemoveFailed'))
  }
}
</script>

<template>
  <section class="border-t border-neutral-200 px-5 py-4" aria-labelledby="report-expenses">
    <div class="flex items-center justify-between gap-2">
      <h3 id="report-expenses" class="text-xs font-semibold tracking-wide text-neutral-500 uppercase">{{ $t('report.expensesInReport') }}</h3>
      <button v-if="editing === null" type="button" class="text-sm font-medium text-neutral-600 underline-offset-2 hover:text-neutral-900 hover:underline" @click="startAdding">
        {{ $t('report.addExpense') }}
      </button>
    </div>
    <p v-if="!expenses.length && editing === null" class="mt-2 text-sm text-neutral-400">{{ $t('report.noExpenses') }}</p>

    <ul v-if="expenses.length" class="mt-2 divide-y divide-neutral-100">
      <li v-for="it in expenses" :key="it.id" class="flex items-start gap-2 py-2">
        <div class="min-w-0 flex-1">
          <p class="truncate text-sm text-neutral-800">{{ it.title }}</p>
          <p class="text-xs text-neutral-400">{{ formatDate(it.completed_on) }}</p>
        </div>
        <span class="shrink-0 pt-px text-sm text-neutral-800 tabular-nums">{{ formatMoney(it.price_cents ?? 0, report.currency) }}</span>
        <button
          type="button"
          class="shrink-0 rounded-md p-1 text-neutral-300 transition hover:bg-neutral-100 hover:text-neutral-700"
          :aria-label="$t('report.editExpense', { title: it.title })"
          :title="$t('common.edit')"
          @click="startEditing(it)"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-4 w-4">
            <path d="M12 20h9" />
            <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
          </svg>
        </button>
        <button
          type="button"
          class="shrink-0 rounded-md p-1 text-neutral-300 transition hover:bg-neutral-100 hover:text-neutral-700"
          :aria-label="$t('report.removeExpense', { title: it.title })"
          :title="$t('report.removeFromReport')"
          @click="remove(it)"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-4 w-4">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </li>
    </ul>

    <form v-if="editing !== null" class="mt-3 space-y-3" novalidate @submit.prevent="save">
      <FormError :message="form.formError" />
      <BaseInput v-bind="form.field('title')" :label="$t('report.expenseTitle')" :placeholder="$t('report.expenseTitlePlaceholder')" />
      <div class="grid grid-cols-2 gap-3">
        <DateInput v-bind="form.field('spent_on')" :label="$t('report.expenseDate')" compact />
        <BaseInput v-bind="form.field('amount')" :label="$t('report.expenseAmount', { currency: report.currency })" />
      </div>
      <div class="flex justify-end gap-2">
        <BaseButton variant="ghost" size="sm" :block="false" :disabled="form.submitting" @click="editing = null">{{ $t('common.cancel') }}</BaseButton>
        <BaseButton type="submit" size="sm" :block="false" :loading="form.submitting" :disabled="form.submitting">{{ $t('common.save') }}</BaseButton>
      </div>
    </form>
  </section>
</template>
