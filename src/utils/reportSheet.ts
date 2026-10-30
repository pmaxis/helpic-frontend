import { t } from '@/i18n'
import { formatDocumentDate, formatDocumentPeriod, formatDuration } from '@/utils/format'
import { formatMoney } from '@/utils/money'
import type { Party } from '@/types/people'
import type { Report } from '@/types/reports'

export interface SheetItem {
  title: string
  /** The task a subtask belongs to, over its title; '' for a top-level task. */
  parentTitle: string
  projectName: string
  completed: string
  /** '' for a task without a price. */
  price: string
  /** The price in hryvnias, "(~ ₴4,502.56)", when they're shown; '' otherwise. */
  priceInUAH: string
  /** The time a task billed by the hour took; '' for a fixed price. */
  time: string
  /** What was done, in a detailed report: paragraphs and lists. */
  notes: TextBlock[]
}

/** What a report's PDF says, worded in the interface's language. */
export interface ReportSheet {
  draft: boolean
  title: string
  /** Under the title: the period, the projects, how many tasks. */
  facts: string[]
  summary: TextBlock[]
  /** A project column when the tasks span projects. */
  showProject: boolean
  /** A price column and the total when any task has a price. */
  showPrice: boolean
  /** A time column when any task is billed by the hour. */
  showTime: boolean
  total: string
  /** The total in hryvnias, "(~ ₴4,502.56)", under the total when they're shown; '' otherwise. */
  totalInUAH: string
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

/** A paragraph of free text, or a list. */
export type TextBlock = { text: string } | { items: string[]; ordered: boolean }

const BULLET_PREFIXES = ['- ', '* ', '• ', '– ', '— ', '-', '•']
const NUMBERED = /^\d{1,3}[.)]\s+/

/** A line's list marker taken off, and whether it numbers the list; null for a plain line. */
function listItem(line: string): { item: string; ordered: boolean } | null {
  const numbered = NUMBERED.exec(line)
  if (numbered) return { item: line.slice(numbered[0].length).trim(), ordered: true }
  const prefix = BULLET_PREFIXES.find((p) => line.startsWith(p))
  return prefix ? { item: line.slice(prefix.length).trim(), ordered: false } : null
}

/**
 * Free text as it was written: paragraphs apart where a blank line parts
 * them, and lists. A marked line ("- ", "• ", "1. "…) is a list item, and
 * items stay one list across blank lines; a block of several plain lines is
 * a list too, a point per line. A plain line among marked ones stays text.
 */
export function splitBlocks(s: string): TextBlock[] {
  const blocks: TextBlock[] = []
  const add = (item: string, ordered: boolean) => {
    const last = blocks.at(-1)
    if (last && 'items' in last && last.ordered === ordered) last.items.push(item)
    else blocks.push({ items: [item], ordered })
  }
  const groups = s.split(/\r?\n\s*\r?\n/).map((g) =>
    g
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean),
  )
  for (const lines of groups) {
    const marked = lines.map(listItem)
    if (marked.every((m) => m === null)) {
      if (lines.length === 1) blocks.push({ text: lines[0] })
      else for (const line of lines) add(line, false)
      continue
    }
    lines.forEach((line, i) => {
      const m = marked[i]
      if (m) add(m.item, m.ordered)
      else blocks.push({ text: line })
    })
  }
  return blocks
}

function signature(p: Party): string {
  return !p.name || p.name === p.email ? p.email : `${p.name} (${p.email})`
}

export interface SheetOptions {
  /** Hryvnias beside the prices, for a client who pays in them, when the report has a rate. */
  inUAH?: boolean
}

export function buildSheet(r: Report, { inUAH = false }: SheetOptions = {}): ReportSheet {
  const items = r.items ?? []
  const uah = inUAH ? r.in_uah : null
  const projects = r.projects.map((p) => p.name).join(', ')

  let footerLeft = t('reportPdf.prepared', { date: formatDocumentDate(r.created_at) })
  if (r.sent_at) footerLeft += ` · ${t('reportPdf.sent', { date: formatDocumentDate(r.sent_at) })}`
  if (r.paid_at) footerLeft += ` · ${t('reportPdf.paid', { date: formatDocumentDate(r.paid_at) })}`

  return {
    draft: r.status === 'draft' && !!r.client,
    title: r.title,
    facts: [formatDocumentPeriod(r.from, r.to), projects, t('reportPdf.completedCount', items.length)].filter(Boolean),
    summary: splitBlocks(r.summary),
    showProject: r.projects.length !== 1 && items.some((it) => it.project_name),
    showPrice: r.total_cents !== null,
    showTime: items.some((it) => it.seconds !== null),
    total: r.total_cents !== null ? formatMoney(r.total_cents, r.currency) : '',
    totalInUAH: uah ? `(~ ${formatMoney(uah.total_cents, 'UAH')})` : '',
    items: items.map((it) => {
      return {
        title: it.title,
        parentTitle: it.parent_title,
        projectName: it.project_name,
        completed: formatDocumentDate(it.completed_on),
        price: it.price_cents !== null ? formatMoney(it.price_cents, r.currency) : '',
        priceInUAH: uah && it.price_in_uah_cents != null ? `(~ ${formatMoney(it.price_in_uah_cents, 'UAH')})` : '',
        time: it.seconds !== null ? formatDuration(it.seconds) : '',
        notes: r.kind === 'detailed' ? splitBlocks(it.notes) : [],
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
