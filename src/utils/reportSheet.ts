import { t } from '@/i18n'
import { formatDocumentDate, formatDocumentPeriod, formatDuration } from '@/utils/format'
import { formatMoney } from '@/utils/money'
import type { Party } from '@/types/people'
import type { Report } from '@/types/reports'

export interface SheetItem {
  title: string
  projectName: string
  completed: string
  /** '' for a task without a price. */
  price: string
  /** The time a task billed by the hour took; '' for a fixed price. */
  time: string
  /** What was done, in a detailed report: a paragraph or bullets. */
  notesText: string
  notesBullets: string[]
}

/** What a report's PDF says, worded in the interface's language. */
export interface ReportSheet {
  draft: boolean
  title: string
  /** Under the title: the period, the projects, how many tasks. */
  facts: string[]
  summaryText: string
  summaryBullets: string[]
  /** A project column when the tasks span projects. */
  showProject: boolean
  /** A price column and the total when any task has a price. */
  showPrice: boolean
  /** A time column when any task is billed by the hour. */
  showTime: boolean
  total: string
  items: SheetItem[]
  /** On every page: when it was prepared, sent and paid; and who made it. */
  footerLeft: string
  footerRight: string
  labels: {
    eyebrow: string
    draft: string
    summary: string
    tasks: string
    task: string
    project: string
    completed: string
    price: string
    time: string
    total: string
    noTasks: string
  }
}

const BULLET_PREFIXES = ['- ', '* ', '• ', '– ', '— ', '-', '•']

/** Free text as a paragraph or, when it has several lines or bullet markers, as bullets. */
export function splitText(s: string): { text: string; bullets: string[] } {
  let marked = false
  const lines = s
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const prefix = BULLET_PREFIXES.find((p) => line.startsWith(p))
      if (!prefix) return line
      marked = true
      return line.slice(prefix.length).trim()
    })
  if (lines.length === 1 && !marked) return { text: lines[0], bullets: [] }
  return { text: '', bullets: lines }
}

function signature(p: Party): string {
  return !p.name || p.name === p.email ? p.email : `${p.name} (${p.email})`
}

export function buildSheet(r: Report): ReportSheet {
  const items = r.items ?? []
  const projects = r.projects.map((p) => p.name).join(', ')
  const summary = splitText(r.summary)

  let footerLeft = t('reportPdf.prepared', { date: formatDocumentDate(r.created_at) })
  if (r.sent_at) footerLeft += ` · ${t('reportPdf.sent', { date: formatDocumentDate(r.sent_at) })}`
  if (r.paid_at) footerLeft += ` · ${t('reportPdf.paid', { date: formatDocumentDate(r.paid_at) })}`

  return {
    draft: r.status === 'draft' && !!r.client,
    title: r.title,
    facts: [formatDocumentPeriod(r.from, r.to), projects, t('reportPdf.completedCount', items.length)].filter(Boolean),
    summaryText: summary.text,
    summaryBullets: summary.bullets,
    showProject: r.projects.length !== 1 && items.some((it) => it.project_name),
    showPrice: r.total_cents !== null,
    showTime: items.some((it) => it.seconds !== null),
    total: r.total_cents !== null ? formatMoney(r.total_cents, r.currency) : '',
    items: items.map((it) => {
      const notes = r.kind === 'detailed' ? splitText(it.notes) : { text: '', bullets: [] }
      return {
        title: it.title,
        projectName: it.project_name,
        completed: formatDocumentDate(it.completed_on),
        price: it.price_cents !== null ? formatMoney(it.price_cents, r.currency) : '',
        time: it.seconds !== null ? formatDuration(it.seconds) : '',
        notesText: notes.text,
        notesBullets: notes.bullets,
      }
    }),
    footerLeft: `${footerLeft} · Helpic`,
    footerRight: signature(r.freelancer),
    labels: {
      eyebrow: t('reportPdf.eyebrow'),
      draft: t('reportPdf.draft'),
      summary: t('reportPdf.summary'),
      tasks: t('reportPdf.tasks'),
      task: t('reportPdf.task'),
      project: t('reportPdf.project'),
      completed: t('reportPdf.completed'),
      price: t('reportPdf.price'),
      time: t('reportPdf.time'),
      total: t('reportPdf.total'),
      noTasks: t('reportPdf.noTasks'),
    },
  }
}
