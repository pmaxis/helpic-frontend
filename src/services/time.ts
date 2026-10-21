import { http } from '@/services/api'
import type { TimeEntry, TimeEntryInput } from '@/types/time'

/** The time on a task, newest day first. For whoever sees its price. */
export async function listTimeEntries(taskId: string): Promise<TimeEntry[]> {
  const { data } = await http.get<{ entries: TimeEntry[] }>('/time-entries', { params: { task: taskId } })
  return data.entries ?? []
}

export async function createTimeEntry(taskId: string, input: TimeEntryInput): Promise<TimeEntry> {
  const { data } = await http.post<{ entry: TimeEntry }>('/time-entries', input, { params: { task: taskId } })
  return data.entry
}

export async function updateTimeEntry(id: string, input: TimeEntryInput): Promise<TimeEntry> {
  const { data } = await http.put<{ entry: TimeEntry }>(`/time-entries/${id}`, input)
  return data.entry
}

export async function deleteTimeEntry(id: string): Promise<void> {
  await http.delete(`/time-entries/${id}`)
}

/** The user's running timer, or null. */
export async function fetchTimer(): Promise<TimeEntry | null> {
  const { data } = await http.get<{ timer: TimeEntry | null }>('/timer')
  return data.timer
}

/** Starts a timer on the task; one running elsewhere stops and keeps its time. */
export async function startTimer(taskId: string): Promise<TimeEntry> {
  const { data } = await http.post<{ timer: TimeEntry }>('/timer', null, { params: { task: taskId } })
  return data.timer
}

/** Stops the running timer; its time is added to its entry. */
export async function stopTimer(): Promise<TimeEntry> {
  const { data } = await http.post<{ entry: TimeEntry }>('/timer/stop')
  return data.entry
}
