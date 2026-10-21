<script setup lang="ts">
/**
 * A freelancer's own hourly rate on a project, beside its name: "$50/h", or
 * their own rate, greyed, while they set none here. A click opens a small
 * dialog to set or clear it; their tasks here billed by the hour follow it.
 */
import { computed, ref } from 'vue'
import Modal from '@/components/ui/Modal.vue'
import RateInput from '@/components/account/RateInput.vue'
import { useAuthStore } from '@/stores/auth'
import { useProjectsStore } from '@/stores/projects'
import { ApiRequestError } from '@/services/api'
import { formatMoney } from '@/utils/money'
import { toast } from '@/composables/useToasts'
import { t } from '@/i18n'
import type { Project } from '@/types/projects'

const props = defineProps<{ project: Project }>()
const emit = defineEmits<{ changed: [project: Project] }>()

const auth = useAuthStore()
const projects = useProjectsStore()

const currency = computed(() => auth.user?.currency ?? 'USD')
const own = computed(() => auth.user?.hourly_rate_cents ?? null)
const rate = computed(() => props.project.my_hourly_rate_cents ?? own.value)

const open = ref(false)
const saving = ref(false)
const error = ref('')

async function save(value: string | null) {
  saving.value = true
  error.value = ''
  try {
    emit('changed', await projects.setRate(props.project.id, value))
    toast.success(t('timelog.rateChanged'))
    open.value = false
  } catch (e) {
    const field = e instanceof ApiRequestError ? e.fields?.rate : undefined
    if (field) error.value = field
    else toast.error(e instanceof ApiRequestError ? e.message : t('timelog.rateFailed'))
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <button
    type="button"
    class="inline-flex h-8 items-center rounded-lg border border-neutral-200 bg-white px-2.5 text-xs font-medium tabular-nums shadow-xs transition-colors hover:bg-neutral-50"
    :class="project.my_hourly_rate_cents === null ? 'text-neutral-400 hover:text-neutral-700' : 'text-neutral-700 hover:text-neutral-900'"
    :title="$t('timelog.projectRate')"
    @click="open = true"
  >
    {{ rate === null ? $t('timelog.projectRate') : $t('timelog.perHour', { amount: formatMoney(rate, currency, { whole: true }) }) }}
  </button>
  <Modal v-if="open" :title="$t('timelog.projectRate')" @close="open = false">
    <p class="text-sm text-neutral-500">
      {{ own === null ? $t('timelog.projectRateTextNone') : $t('timelog.projectRateText', { rate: $t('timelog.perHour', { amount: formatMoney(own, currency, { whole: true }) }) }) }}
    </p>
    <RateInput
      class="mt-4"
      :cents="project.my_hourly_rate_cents"
      :currency="currency"
      :label="$t('timelog.projectRate')"
      :saving="saving"
      :error="error"
      @save="save"
    />
  </Modal>
</template>
