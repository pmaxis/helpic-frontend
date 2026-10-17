import { useViewMode } from './useViewMode'

/** The List / Board choice for task pages (?view=board). */
export function useTaskView() {
  return useViewMode('helpic:task-view', ['list', 'board'] as const, 'list')
}
