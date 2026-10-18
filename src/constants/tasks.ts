import { t } from '@/i18n'
import type { TaskPriority, TaskStatus } from '@/types/tasks'

/** Most urgent first, as pickers list them. */
export const PRIORITY_ORDER: TaskPriority[] = ['urgent', 'high', 'medium', 'low', 'none']

/** "Urgent", "No priority", in the interface's language. */
export function priorityLabel(p: TaskPriority): string {
  return t(`priority.${p}`)
}

/** The priorities as select options, most urgent first. Call it where it renders, so it follows the language. */
export function priorityOptions(): { value: TaskPriority; label: string }[] {
  return PRIORITY_ORDER.map((p) => ({ value: p, label: priorityLabel(p) }))
}

/** Label colors: the backend's palette names, each with a chip and a dot. Full class names, so Tailwind keeps them. */
export const LABEL_COLORS: Record<string, { chip: string; dot: string }> = {
  gray: { chip: 'bg-neutral-100 text-neutral-700 ring-neutral-500/20', dot: 'bg-neutral-400' },
  red: { chip: 'bg-red-50 text-red-700 ring-red-600/20', dot: 'bg-red-500' },
  orange: { chip: 'bg-orange-50 text-orange-700 ring-orange-600/20', dot: 'bg-orange-500' },
  amber: { chip: 'bg-amber-50 text-amber-800 ring-amber-600/20', dot: 'bg-amber-400' },
  green: { chip: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20', dot: 'bg-emerald-500' },
  teal: { chip: 'bg-teal-50 text-teal-700 ring-teal-600/20', dot: 'bg-teal-500' },
  blue: { chip: 'bg-sky-50 text-sky-700 ring-sky-600/20', dot: 'bg-sky-500' },
  violet: { chip: 'bg-violet-50 text-violet-700 ring-violet-600/20', dot: 'bg-violet-500' },
  pink: { chip: 'bg-pink-50 text-pink-700 ring-pink-600/20', dot: 'bg-pink-500' },
}
export const LABEL_COLOR_NAMES = Object.keys(LABEL_COLORS)

export const STATUSES: TaskStatus[] = ['new', 'in_progress', 'done']

/** "New", "In progress", in the interface's language. */
export function statusLabel(s: TaskStatus): string {
  return t(`status.${s}`)
}

/** The names Helpic gives the columns it makes: shown in the interface's language. */
const DEFAULT_COLUMNS: Record<string, TaskStatus | 'paid'> = {
  New: 'new',
  'In progress': 'in_progress',
  Done: 'done',
  Paid: 'paid',
}

/**
 * A board column's name as shown: one Helpic made by default is translated,
 * one the user named stays as they wrote it.
 */
export function columnName(name: string): string {
  const key = DEFAULT_COLUMNS[name]
  return key ? t(`status.${key}`) : name
}

export const STATUS_BADGE: Record<TaskStatus, string> = {
  new: 'bg-sky-50 text-sky-700 ring-sky-600/20',
  in_progress: 'bg-amber-50 text-amber-700 ring-amber-600/20',
  done: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
}

/** Solid colour for a small status dot, e.g. in a board column header. */
export const STATUS_DOT: Record<TaskStatus, string> = {
  new: 'bg-sky-500',
  in_progress: 'bg-amber-500',
  done: 'bg-emerald-500',
}
