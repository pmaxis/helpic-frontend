import type { Party } from './people'

/** A basic report lists the tasks; a detailed one also says what was done in each. */
export type ReportKind = 'basic' | 'detailed'

export interface ReportItem {
  id: string
  /** Null once the task itself was deleted; the report keeps its snapshot. */
  task_id: string | null
  title: string
  /** The title of the task a subtask belongs to, as it was then; '' for a top-level task. */
  parent_title: string
  project_name: string
  status_name: string
  /** YYYY-MM-DD */
  completed_on: string
  /** Null for a task without a price. Live while a draft, frozen once sent. */
  price_cents: number | null
  /** The price in hryvnias at the report's rate (see in_uah); null without a price or a rate. */
  price_in_uah_cents?: number | null
  /** The time a task billed by the hour took; null for a fixed price. */
  seconds: number | null
  /** What was done in the task, shown in a detailed report. Starts as the task's description. */
  notes: string
  /** The client asked about the line, and it isn't resolved yet. */
  question_open: boolean
  /** What was said about the line. */
  comment_count: number
}

/** How a freelancer's reports look: live on a draft, as it was sent on a sent report. */
export interface Branding {
  /** The accent, "#rrggbb"; null for plain black. */
  color: string | null
  /** Business details printed at the end, line by line as written. */
  details: string
  /** Changes with every new logo; null without one. */
  logo_id: string | null
}

/** A freelancer's report of the work done for a client over a period. */
export interface Report {
  id: string
  freelancer: Party
  /** Null for a report on personal work, which is only downloaded. */
  client: Party | null
  /** The projects it covers, named as they were when it was made; empty means all. id is '' once a project is deleted. */
  projects: { id: string; name: string }[]
  title: string
  summary: string
  kind: ReportKind
  /** YYYY-MM-DD */
  from: string
  to: string
  /** A client marks a sent report paid; its tasks then move to the board's Paid column. */
  status: 'draft' | 'sent' | 'paid'
  sent_at: string | null
  paid_at: string | null
  /** When the freelancer last took it back to correct it. */
  recalled_at: string | null
  item_count: number
  /** Lines with a question waiting, and the whole discussion. */
  open_questions: number
  comment_count: number
  /** Present on a single report. */
  items?: ReportItem[]
  currency: string
  /** The logo is at /reports/{id}/logo. */
  branding: Branding
  /** Sum of the items' prices on a single report; null when none has a price. */
  total_cents: number | null
  /**
   * The total in hryvnias at the NBU's official rate, on a single report in
   * another currency: as of the day it was paid, or today while it isn't.
   * null for a report in hryvnias, without prices, or with no rate known.
   */
  in_uah?: { rate: string; rate_on: string; total_cents: number } | null
  /** The freelancer, while it's a draft. */
  can_edit: boolean
  /** The freelancer, sent or not; a deleted sent report is gone for the client too. */
  can_delete: boolean
  /** The client, while it's sent and not yet paid. */
  can_mark_paid: boolean
  /** Either side, while it's sent or taken back to correct, until paid. */
  can_comment: boolean
  /** The freelancer, while it's sent and not yet paid. */
  can_recall: boolean
  created_at: string
  updated_at: string
}

export interface ReportInput {
  /** Omitted for a report on personal work. */
  client_id?: string
  /** Limit the report to these projects; none means all. */
  project_ids?: string[]
  from: string
  to: string
  title?: string
  summary?: string
  kind?: ReportKind
}

export type ReportEventKind = 'created' | 'title' | 'summary' | 'kind' | 'item_notes' | 'item_removed' | 'sent' | 'paid' | 'question' | 'resolved' | 'recalled'

/** One message in a report's discussion. */
export interface ReportComment {
  id: string
  /** The line it's about; null for the report as a whole, or once the line was dropped. */
  item_id: string | null
  /** That line's task as it was named; '' for the report as a whole. */
  item_title: string
  author: Party
  body: string
  created_at: string
}

/** One change in a report's history. A client sees what happened once it reached them. */
export interface ReportEvent {
  id: string
  actor: { id: string; name: string; email: string }
  kind: ReportEventKind
  /** from/to for a title or kind, task for an item, tasks (a count) for a payment. */
  data: { from?: string; to?: string; task?: string; tasks?: number }
  created_at: string
}
