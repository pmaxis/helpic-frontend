<script setup lang="ts">
/**
 * What a report's freelancer and client say about it once it's sent: a
 * thread under each line and one about the report as a whole. The client's
 * comment on a line asks a question about it, open until either side
 * resolves it. Lines dropped from the report keep what was said about them,
 * to read. Once the report is paid it all stays, to read.
 */
import { computed, ref, watch } from 'vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import { useAuthStore } from '@/stores/auth'
import { useReportsStore } from '@/stores/reports'
import { ApiRequestError } from '@/services/api'
import { formatDate, timeAgo } from '@/utils/format'
import { formatMoney } from '@/utils/money'
import { toast } from '@/composables/useToasts'
import { t } from '@/i18n'
import type { Report, ReportComment, ReportItem } from '@/types/reports'

const props = defineProps<{
  report: Report
  /** Changes whenever the report does, so the discussion reloads. */
  version: number
}>()
const emit = defineEmits<{
  /** The report as the server has it after a question was resolved. */
  changed: [report: Report]
  /** Something was said: the report's counts are out of date. */
  commented: []
}>()

/** As the backend checks it. */
const MAX_COMMENT = 5000
/** The thread about the report as a whole. */
const GENERAL = ''

const auth = useAuthStore()
const reports = useReportsStore()

const comments = ref<ReportComment[]>([])

watch(
  () => [props.report.id, props.version] as const,
  async ([id]) => {
    try {
      const list = await reports.fetchComments(id)
      if (id === props.report.id) comments.value = list
    } catch {
      toast.error(t('reportDiscussion.loadFailed'))
    }
  },
  { immediate: true },
)

const isClient = computed(() => props.report.client?.id === auth.user?.id)

const general = computed(() => comments.value.filter((c) => c.item_id === null && c.item_title === ''))
const onLine = (it: ReportItem) => comments.value.filter((c) => c.item_id === it.id)
/** Lines dropped after something was said about them, by their name then. */
const dropped = computed(() => {
  const byTitle = new Map<string, ReportComment[]>()
  for (const c of comments.value) {
    if (c.item_id !== null || c.item_title === '') continue
    byTitle.set(c.item_title, [...(byTitle.get(c.item_title) ?? []), c])
  }
  return [...byTitle].map(([title, list]) => ({ title, comments: list }))
})

/** Threads open to read and write; lines with a question start open. */
const open = ref(new Set<string>())
watch(
  () => props.report.items,
  (items) => {
    const next = new Set(open.value)
    for (const it of items ?? []) if (it.question_open) next.add(it.id)
    open.value = next
  },
  { immediate: true },
)

function toggle(key: string) {
  const next = new Set(open.value)
  if (next.has(key)) next.delete(key)
  else next.add(key)
  open.value = next
}

function who(c: ReportComment): string {
  return c.author.id === auth.user?.id ? t('common.you_capital') : c.author.name || c.author.email
}

// --- writing ----------------------------------------------------------------------

/** What's being written in each thread, by line ID ('' for the report as a whole). */
const drafts = ref<Record<string, string>>({})
const sending = ref('')

/** The button under a line's thread: the client asks about a line that has no question; anything else answers. */
function sendLabel(it: ReportItem): string {
  if (isClient.value && !it.question_open) return t('reportDiscussion.ask')
  return onLine(it).length ? t('reportDiscussion.reply') : t('reportDiscussion.send')
}

async function send(key: string) {
  const body = (drafts.value[key] ?? '').trim()
  if (!body || sending.value) return
  if (body.length > MAX_COMMENT) {
    toast.error(t('reportDiscussion.tooLong'))
    return
  }
  sending.value = key
  try {
    const c = await reports.addComment(props.report.id, body, key || undefined)
    comments.value = [...comments.value, c]
    drafts.value = { ...drafts.value, [key]: '' }
    emit('commented')
  } catch (error) {
    toast.error(error instanceof ApiRequestError ? (error.fields?.body ?? error.message) : t('reportDiscussion.sendFailed'))
  } finally {
    sending.value = ''
  }
}

/** ⌘/Ctrl + Enter sends, as in a task's comments. */
function onKey(event: KeyboardEvent, key: string) {
  if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
    event.preventDefault()
    void send(key)
  }
}

const resolving = ref('')

async function resolve(it: ReportItem) {
  resolving.value = it.id
  try {
    emit('changed', await reports.resolveQuestion(props.report.id, it.id))
    toast.success(t('reportDiscussion.resolved'))
  } catch (error) {
    toast.error(error instanceof ApiRequestError ? error.message : t('reportDiscussion.resolveFailed'))
  } finally {
    resolving.value = ''
  }
}
</script>

<template>
  <section class="border-b border-neutral-200 px-5 py-4" aria-labelledby="report-discussion">
    <div class="flex items-center justify-between gap-2">
      <h3 id="report-discussion" class="text-xs font-semibold tracking-wide text-neutral-500 uppercase">{{ $t('reportDiscussion.title') }}</h3>
      <span v-if="report.open_questions" class="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700 ring-1 ring-amber-600/20 ring-inset">
        {{ $t('reportDiscussion.openQuestions', { n: report.open_questions }, report.open_questions) }}
      </span>
    </div>
    <p v-if="report.can_comment" class="mt-1 text-xs text-neutral-400">
      {{ isClient ? $t('reportDiscussion.hintClient') : $t('reportDiscussion.hintFreelancer') }}
    </p>
    <p v-else class="mt-1 text-xs text-neutral-400">{{ $t('reportDiscussion.closed') }}</p>

    <ul class="mt-2 divide-y divide-neutral-100">
      <!-- the report as a whole -->
      <li v-if="report.can_comment || general.length" class="py-2">
        <button
          type="button"
          class="-mx-1 flex w-[calc(100%+0.5rem)] items-center gap-2 rounded-md px-1 py-0.5 text-left transition-colors hover:bg-neutral-100"
          :aria-expanded="open.has(GENERAL)"
          @click="toggle(GENERAL)"
        >
          <span class="min-w-0 flex-1 truncate text-sm font-medium text-neutral-800">{{ $t('reportDiscussion.general') }}</span>
          <span v-if="general.length" class="shrink-0 text-xs text-neutral-400 tabular-nums">{{ general.length }}</span>
        </button>
        <div v-if="open.has(GENERAL)" class="mt-2">
          <ol class="space-y-2">
            <li v-for="c in general" :key="c.id" class="rounded-lg bg-neutral-50 px-2.5 py-2">
              <p class="text-xs text-neutral-500">
                <span class="font-medium text-neutral-800">{{ who(c) }}</span>
                <time class="ml-1 text-neutral-400" :datetime="c.created_at" :title="formatDate(c.created_at)">{{ timeAgo(c.created_at) }}</time>
              </p>
              <p class="mt-0.5 text-sm whitespace-pre-line text-neutral-800">{{ c.body }}</p>
            </li>
          </ol>
          <form v-if="report.can_comment" class="mt-2 space-y-2" @submit.prevent="send(GENERAL)">
            <label for="comment-general" class="sr-only">{{ $t('reportDiscussion.aboutReport') }}</label>
            <textarea
              id="comment-general"
              v-model="drafts[GENERAL]"
              rows="2"
              :placeholder="$t('reportDiscussion.placeholder')"
              class="block w-full resize-y rounded-md border border-neutral-200 bg-white px-2 py-1.5 text-sm leading-relaxed text-neutral-800 focus:border-neutral-900 focus:ring-2 focus:ring-neutral-900/10 focus:outline-none"
              @keydown="onKey($event, GENERAL)"
            />
            <div class="flex justify-end">
              <BaseButton type="submit" size="sm" :block="false" :loading="sending === GENERAL" :disabled="!drafts[GENERAL]?.trim() || !!sending">
                {{ $t('reportDiscussion.send') }}
              </BaseButton>
            </div>
          </form>
        </div>
      </li>

      <!-- a thread under each line -->
      <li v-for="it in report.items" :key="it.id" class="py-2">
        <button
          type="button"
          class="-mx-1 flex w-[calc(100%+0.5rem)] items-center gap-2 rounded-md px-1 py-0.5 text-left transition-colors hover:bg-neutral-100"
          :aria-expanded="open.has(it.id)"
          @click="toggle(it.id)"
        >
          <span class="min-w-0 flex-1">
            <span v-if="it.parent_title" class="block truncate text-xs text-neutral-400">{{ it.parent_title }} ›</span>
            <span class="block truncate text-sm text-neutral-800">{{ it.title }}</span>
          </span>
          <span v-if="it.question_open" class="shrink-0 rounded-full bg-amber-50 px-1.5 py-px text-[11px] font-medium text-amber-700 ring-1 ring-amber-600/20 ring-inset">
            {{ $t('reportDiscussion.question') }}
          </span>
          <span v-else-if="onLine(it).length" class="shrink-0 text-xs text-neutral-400 tabular-nums" :aria-label="$t('reportDiscussion.comments', { n: onLine(it).length })">
            {{ onLine(it).length }}
          </span>
          <span v-if="it.price_cents !== null" class="shrink-0 text-sm text-neutral-600 tabular-nums">{{ formatMoney(it.price_cents, report.currency) }}</span>
        </button>
        <div v-if="open.has(it.id)" class="mt-2">
          <ol v-if="onLine(it).length" class="space-y-2">
            <li v-for="c in onLine(it)" :key="c.id" class="rounded-lg bg-neutral-50 px-2.5 py-2">
              <p class="text-xs text-neutral-500">
                <span class="font-medium text-neutral-800">{{ who(c) }}</span>
                <time class="ml-1 text-neutral-400" :datetime="c.created_at" :title="formatDate(c.created_at)">{{ timeAgo(c.created_at) }}</time>
              </p>
              <p class="mt-0.5 text-sm whitespace-pre-line text-neutral-800">{{ c.body }}</p>
            </li>
          </ol>
          <form v-if="report.can_comment" class="mt-2 space-y-2" @submit.prevent="send(it.id)">
            <label :for="`comment-${it.id}`" class="sr-only">{{ $t('reportDiscussion.aboutLine', { title: it.title }) }}</label>
            <textarea
              :id="`comment-${it.id}`"
              v-model="drafts[it.id]"
              rows="2"
              :placeholder="isClient && !it.question_open ? $t('reportDiscussion.askPlaceholder') : $t('reportDiscussion.placeholder')"
              class="block w-full resize-y rounded-md border border-neutral-200 bg-white px-2 py-1.5 text-sm leading-relaxed text-neutral-800 focus:border-neutral-900 focus:ring-2 focus:ring-neutral-900/10 focus:outline-none"
              @keydown="onKey($event, it.id)"
            />
            <div class="ml-auto grid grid-flow-col [grid-auto-columns:1fr] gap-2 w-fit">
              <BaseButton
                v-if="it.question_open"
                variant="ghost"
                size="sm"
                :block="false"
                :loading="resolving === it.id"
                :disabled="!!resolving"
                @click="resolve(it)"
              >
                {{ $t('reportDiscussion.resolve') }}
              </BaseButton>
              <BaseButton type="submit" size="sm" :block="false" :loading="sending === it.id" :disabled="!drafts[it.id]?.trim() || !!sending">
                {{ sendLabel(it) }}
              </BaseButton>
            </div>
          </form>
        </div>
      </li>

      <!-- lines dropped after they were talked about -->
      <li v-for="d in dropped" :key="`dropped-${d.title}`" class="py-2">
        <button
          type="button"
          class="-mx-1 flex w-[calc(100%+0.5rem)] items-center gap-2 rounded-md px-1 py-0.5 text-left transition-colors hover:bg-neutral-100"
          :aria-expanded="open.has(`dropped-${d.title}`)"
          @click="toggle(`dropped-${d.title}`)"
        >
          <span class="min-w-0 flex-1 truncate text-sm text-neutral-400 line-through">{{ d.title }}</span>
          <span class="shrink-0 text-xs text-neutral-400">{{ $t('reportDiscussion.dropped') }}</span>
        </button>
        <ol v-if="open.has(`dropped-${d.title}`)" class="mt-2 space-y-2">
          <li v-for="c in d.comments" :key="c.id" class="rounded-lg bg-neutral-50 px-2.5 py-2">
            <p class="text-xs text-neutral-500">
              <span class="font-medium text-neutral-800">{{ who(c) }}</span>
              <time class="ml-1 text-neutral-400" :datetime="c.created_at" :title="formatDate(c.created_at)">{{ timeAgo(c.created_at) }}</time>
            </p>
            <p class="mt-0.5 text-sm whitespace-pre-line text-neutral-800">{{ c.body }}</p>
          </li>
        </ol>
      </li>
    </ul>
  </section>
</template>
