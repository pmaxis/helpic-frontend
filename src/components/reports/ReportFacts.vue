<script setup lang="ts">
/** What a report is: for whom, over when, which projects, how many tasks and the total. */
import { computed } from 'vue'
import ToggleSwitch from '@/components/ui/ToggleSwitch.vue'
import { formatDate } from '@/utils/format'
import { formatMoney } from '@/utils/money'
import type { Report } from '@/types/reports'

const props = defineProps<{
  report: Report
  /** Hryvnias are shown beside the prices. */
  modelValue: boolean
}>()
const emit = defineEmits<{ 'update:modelValue': [on: boolean] }>()

const inUAH = computed({
  get: () => props.modelValue,
  set: (on) => emit('update:modelValue', on),
})

const period = computed(() => {
  const r = props.report
  return r.from === r.to ? formatDate(r.from) : `${formatDate(r.from)} – ${formatDate(r.to)}`
})
</script>

<template>
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
    <!-- for a client who pays in hryvnias -->
    <template v-if="report.in_uah">
      <dt class="text-neutral-500">{{ $t('report.inUAH') }}</dt>
      <dd>
        <span class="font-semibold text-neutral-900">≈ {{ formatMoney(report.in_uah.total_cents, 'UAH') }}</span>
        <span class="block text-xs text-neutral-500">
          {{ $t('report.inUAHRate', { rate: report.in_uah.rate, date: formatDate(report.in_uah.rate_on) }) }}
        </span>
        <label class="mt-2 flex items-center gap-2 text-xs text-neutral-600">
          <ToggleSwitch v-model="inUAH" :label="$t('report.inUAHShow')" />
          <span aria-hidden="true">{{ $t('report.inUAHShow') }}</span>
        </label>
      </dd>
    </template>
  </dl>
</template>
