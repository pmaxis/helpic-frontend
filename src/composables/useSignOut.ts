import { usePeopleStore } from '@/stores/people'
import { useTasksStore } from '@/stores/tasks'
import { useProjectsStore } from '@/stores/projects'
import { useBoardStore } from '@/stores/board'
import { useReportsStore } from '@/stores/reports'
import { useNotificationsStore } from '@/stores/notifications'
import { useTimerStore } from '@/stores/timer'

/**
 * Drops the previous account's data, once it signed out or was deleted,
 * before someone else signs in.
 */
export function forgetAccountData(): void {
  usePeopleStore().$reset()
  useTasksStore().$reset()
  useProjectsStore().$reset()
  useBoardStore().$reset()
  useReportsStore().$reset()
  const notifications = useNotificationsStore()
  notifications.stopPolling()
  notifications.$reset()
  useTimerStore().reset()
}
