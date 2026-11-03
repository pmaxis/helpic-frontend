/** Made-up records for tests: valid by default, with only what a test cares about overridden. */
import type { User } from '@/types/auth'
import type { BoardColumn } from '@/types/board'
import type { Link } from '@/types/people'
import type { Project } from '@/types/projects'
import type { Report, ReportItem } from '@/types/reports'
import type { Task, TaskEstimate } from '@/types/tasks'
import type { TimeEntry } from '@/types/time'

const freelancer = { id: 'u-freelancer', name: 'Olena Freelancer', email: 'olena@example.test' }
const client = { id: 'u-client', name: 'Acme', email: 'acme@example.test' }

export function makeTask(over: Partial<Task> = {}): Task {
  return {
    id: 't-1',
    freelancer,
    client,
    project: null,
    status_id: 'c-todo',
    status_name: 'To do',
    position: null,
    created_by: freelancer.id,
    creator: freelancer,
    participants: [freelancer],
    title: 'Write the landing page',
    description: '',
    status: 'new',
    due_on: null,
    price_cents: null,
    currency: 'USD',
    billing: 'fixed',
    tracked_seconds: null,
    hourly_rate_cents: null,
    priority: 'none',
    labels: [],
    next_statuses: ['in_progress', 'done'],
    can_edit: true,
    can_delete: true,
    can_set_price: true,
    can_see_price: true,
    can_track_time: true,
    billed: false,
    can_archive: false,
    can_share: false,
    in_backlog: false,
    can_backlog: true,
    created_at: '2030-01-10T09:00:00Z',
    updated_at: '2030-01-10T09:00:00Z',
    archived_at: null,
    archived_by: null,
    parent_id: null,
    parent: null,
    subtasks: { total: 0, done: 0 },
    can_add_subtask: true,
    estimate_seconds: null,
    can_estimate: false,
    estimate: null,
    can_send_estimate: false,
    can_withdraw_estimate: false,
    can_review_estimate: false,
    ...over,
  }
}

/** An estimate sent and waiting for the client. */
export function makeEstimate(over: Partial<TaskEstimate> = {}): TaskEstimate {
  return {
    billing: 'fixed',
    seconds: 8 * 3600,
    cents: 50000,
    currency: 'USD',
    sent_at: '2030-01-11T09:00:00Z',
    status: 'pending',
    note: '',
    reviewed_at: null,
    reviewer: null,
    outdated: false,
    ...over,
  }
}

export function makeColumn(over: Partial<BoardColumn> = {}): BoardColumn & { tasks: Task[] } {
  return {
    id: 'c-todo',
    name: 'To do',
    category: 'new',
    status_category: 'todo',
    participants_can_move: true,
    tasks: [],
    ...over,
  } as BoardColumn & { tasks: Task[] }
}

export function makeTimeEntry(over: Partial<TimeEntry> = {}): TimeEntry {
  return {
    id: 'e-1',
    task_id: 't-1',
    task_title: 'Write the landing page',
    user: freelancer,
    spent_on: '2030-01-10',
    seconds: 0,
    note: '',
    running_since: null,
    can_edit: true,
    created_at: '2030-01-10T09:00:00Z',
    ...over,
  }
}

export function makeUser(over: Partial<User> = {}): User {
  return {
    id: freelancer.id,
    email: freelancer.email,
    first_name: 'Olena',
    last_name: 'Freelancer',
    name: freelancer.name,
    role: 'freelancer',
    currency: 'USD',
    hourly_rate_cents: null,
    locale: 'en',
    member_of: null,
    two_factor: false,
    created_at: '2030-01-01T09:00:00Z',
    ...over,
  }
}

export function makeProject(over: Partial<Project> = {}): Project {
  return {
    id: 'p-1',
    freelancer,
    client,
    created_by: freelancer.id,
    name: 'Landing',
    description: '',
    open_tasks: 0,
    total_tasks: 0,
    participants: [],
    can_edit: true,
    can_set_rate: true,
    my_hourly_rate_cents: null,
    created_at: '2030-01-01T09:00:00Z',
    updated_at: '2030-01-01T09:00:00Z',
    ...over,
  }
}

export function makeLink(over: Partial<Link> = {}): Link {
  return { ...client, linked_at: '2030-01-01T09:00:00Z', open_tasks: 0, ...over }
}

export function makeReportItem(over: Partial<ReportItem> = {}): ReportItem {
  return {
    id: 'i-1',
    task_id: 't-1',
    title: 'Write the landing page',
    parent_title: '',
    project_name: '',
    status_name: 'Done',
    completed_on: '2030-01-20',
    price_cents: null,
    seconds: null,
    notes: '',
    question_open: false,
    comment_count: 0,
    ...over,
  }
}

export function makeReport(over: Partial<Report> = {}): Report {
  return {
    id: 'r-1',
    freelancer,
    client,
    projects: [],
    title: 'January',
    summary: '',
    kind: 'basic',
    from: '2030-01-01',
    to: '2030-01-31',
    status: 'draft',
    sent_at: null,
    paid_at: null,
    item_count: 0,
    items: [],
    currency: 'USD',
    branding: { color: null, details: '', logo_id: null },
    recalled_at: null,
    review: null,
    reviewed_at: null,
    review_note: '',
    review_answer: '',
    open_questions: 0,
    comment_count: 0,
    can_comment: false,
    can_recall: false,
    can_review: false,
    can_answer: false,
    total_cents: null,
    can_edit: true,
    can_delete: true,
    can_mark_paid: false,
    created_at: '2030-02-01T09:00:00Z',
    updated_at: '2030-02-01T09:00:00Z',
    ...over,
  }
}
