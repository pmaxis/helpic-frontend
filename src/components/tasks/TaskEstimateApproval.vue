<script setup lang="ts">
/**
 * Where the client stands on the task's estimate, at the foot of its price
 * block: waiting, approved, changes asked for (saying what), or out of date
 * since the task changed. The freelancer sends it, or takes it back before
 * the client answers; the client approves it, or asks for changes. Work
 * goes on either way.
 */
import { computed, ref } from 'vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseTextarea from '@/components/ui/BaseTextarea.vue'
import Modal from '@/components/ui/Modal.vue'
import { useTasksStore } from '@/stores/tasks'
import { useAuthStore } from '@/stores/auth'
import { ApiRequestError } from '@/services/api'
import { formatDate, formatDuration } from '@/utils/format'
import { formatMoney } from '@/utils/money'
import { toast } from '@/composables/useToasts'
import { t } from '@/i18n'
import type { Task, TaskEstimate } from '@/types/tasks'

const props = defineProps<{ task: Task }>()
const emit = defineEmits<{
  /** The task as the server has it after a change here. */
  changed: [task: Task]
}>()

const tasks = useTasksStore()
const auth = useAuthStore()

function errorMessage(error: unknown): string {
  return error instanceof ApiRequestError ? (Object.values(error.fields ?? {})[0] ?? error.message) : t('estimate.failed')
}

// --- where it stands ---------------------------------------------------------------

type Shown = TaskEstimate['status'] | 'outdated'

const state = computed<Shown | null>(() => {
  const e = props.task.estimate
  if (!e) return null
  return e.outdated ? 'outdated' : e.status
})

const BADGE: Record<Shown, string> = {
  pending: 'bg-amber-50 text-amber-700 ring-amber-600/20',
  approved: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
  changes_requested: 'bg-red-50 text-red-700 ring-red-600/20',
  outdated: 'bg-neutral-100 text-neutral-600 ring-neutral-500/20',
}

/** The client is the one it waits for. */
const waitsForMe = computed(() => state.value === 'pending' && props.task.can_review_estimate)

/** What was sent, as it was: "8h · $500". */
function sentValue(e: TaskEstimate): string {
  return [e.seconds !== null ? formatDuration(e.seconds) : '', e.cents !== null ? formatMoney(e.cents, e.currency) : ''].filter(Boolean).join(' · ')
}

function reviewer(e: TaskEstimate): string {
  if (!e.reviewer) return ''
  return e.reviewer.id === auth.user?.id ? t('common.you_capital') : e.reviewer.name || e.reviewer.email
}

// --- the freelancer's say --------------------------------------------------------

const acting = ref<'send' | 'withdraw' | 'approved' | 'changes_requested' | null>(null)

async function send() {
  acting.value = 'send'
  try {
    emit('changed', await tasks.sendEstimate(props.task.id))
    toast.success(t('estimate.sent'))
  } catch (error) {
    toast.error(errorMessage(error))
  } finally {
    acting.value = null
  }
}

async function withdraw() {
  acting.value = 'withdraw'
  try {
    emit('changed', await tasks.withdrawEstimate(props.task.id))
    toast.success(t('estimate.withdrawn'))
  } catch (error) {
    toast.error(errorMessage(error))
  } finally {
    acting.value = null
  }
}

// --- the client's say ------------------------------------------------------------

const asking = ref(false)
const note = ref('')
const noteError = ref('')

async function review(decision: 'approved' | 'changes_requested', text = '') {
  acting.value = decision
  noteError.value = ''
  try {
    emit('changed', await tasks.reviewEstimate(props.task.id, decision, text))
    toast.success(decision === 'approved' ? t('estimate.approved') : t('estimate.changesAsked'))
    asking.value = false
    note.value = ''
  } catch (error) {
    if (asking.value) noteError.value = errorMessage(error)
    else toast.error(errorMessage(error))
  } finally {
    acting.value = null
  }
}

function openAsk() {
  asking.value = true
  noteError.value = ''
}

function ask() {
  if (!note.value.trim()) {
    noteError.value = t('estimate.changesRequired')
    return
  }
  void review('changes_requested', note.value)
}

function onKey(e: KeyboardEvent) {
  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
    e.preventDefault()
    ask()
  }
}
</script>

<template>
  <div class="mt-3 border-t border-neutral-100 pt-3">
    <dl class="grid grid-cols-[6.5rem_minmax(0,1fr)] items-center gap-x-3 text-sm">
      <dt class="text-neutral-500">{{ $t('estimate.state') }}</dt>
      <dd class="min-w-0 border border-transparent px-3">
        <span v-if="state" class="inline-flex max-w-full truncate rounded-full px-2 py-px text-xs font-medium whitespace-nowrap ring-1 ring-inset" :class="BADGE[state]">
          {{ waitsForMe ? $t('estimate.youToApprove') : $t(`estimate.status.${state}`) }}
        </span>
        <span v-else class="text-neutral-400">{{ $t('estimate.notSent') }}</span>
      </dd>
    </dl>

    <template v-if="task.estimate">
      <!-- when it went out, and what the client made of it -->
      <p class="mt-3 text-xs text-neutral-500">
        <template v-if="task.estimate.outdated">{{ $t('estimate.sentWas', { value: sentValue(task.estimate) }) }} · </template>
        {{ $t('estimate.sentOn', { date: formatDate(task.estimate.sent_at) }) }}
        <template v-if="task.estimate.reviewed_at && task.estimate.reviewer">
          · {{ $t('estimate.reviewedBy', { who: reviewer(task.estimate), date: formatDate(task.estimate.reviewed_at) }) }}
        </template>
      </p>
      <blockquote
        v-if="task.estimate.status === 'changes_requested' && task.estimate.note"
        class="mt-2 rounded-lg bg-red-50 px-3 py-2 text-sm whitespace-pre-line text-red-900 ring-1 ring-red-600/20 ring-inset"
      >
        {{ task.estimate.note }}
      </blockquote>
    </template>

    <!-- the freelancer sends it, or takes it back -->
    <div v-if="task.can_send_estimate || task.can_withdraw_estimate" class="mt-3 grid gap-2">
      <BaseButton v-if="task.can_send_estimate" size="sm" :loading="acting === 'send'" :disabled="!!acting" @click="send">
        {{ task.estimate ? $t('estimate.sendAgain') : $t('estimate.send') }}
      </BaseButton>
      <BaseButton v-if="task.can_withdraw_estimate" variant="ghost" size="sm" :loading="acting === 'withdraw'" :disabled="!!acting" @click="withdraw">
        {{ $t('estimate.withdraw') }}
      </BaseButton>
    </div>

    <!-- the client approves it, or asks for changes -->
    <div v-if="task.can_review_estimate && task.estimate" class="mt-3 grid gap-2">
      <BaseButton
        size="sm"
        :variant="task.estimate.status === 'approved' || waitsForMe ? 'primary' : 'ghost'"
        :loading="acting === 'approved'"
        :disabled="!!acting || task.estimate.status === 'approved'"
        :aria-pressed="task.estimate.status === 'approved'"
        @click="review('approved')"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-4 w-4" aria-hidden="true"><polyline points="20 6 9 17 4 12" /></svg>
        {{ $t('estimate.approve') }}
      </BaseButton>
      <BaseButton
        size="sm"
        variant="ghost"
        :disabled="!!acting"
        :aria-pressed="task.estimate.status === 'changes_requested'"
        @click="openAsk"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-4 w-4" aria-hidden="true"><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg>
        {{ $t('estimate.askChanges') }}
      </BaseButton>
    </div>

    <Modal v-if="asking" :title="$t('estimate.changesTitle')" @close="asking = false">
      <form id="estimate-changes" class="space-y-3" novalidate @submit.prevent="ask">
        <p class="text-sm leading-relaxed text-neutral-600">{{ $t('estimate.changesText', { name: task.freelancer?.name || task.freelancer?.email || '' }) }}</p>
        <BaseTextarea
          v-model="note"
          :label="$t('estimate.noteLabel')"
          :placeholder="$t('estimate.notePlaceholder')"
          :rows="4"
          :error="noteError"
          required
          @keydown="onKey"
        />
      </form>
      <template #footer>
        <BaseButton variant="ghost" size="sm" :block="false" :disabled="!!acting" @click="asking = false">{{ $t('common.cancel') }}</BaseButton>
        <BaseButton type="submit" form="estimate-changes" size="sm" :block="false" :loading="acting === 'changes_requested'" :disabled="!!acting">
          {{ $t('estimate.submitChanges') }}
        </BaseButton>
      </template>
    </Modal>
  </div>
</template>
