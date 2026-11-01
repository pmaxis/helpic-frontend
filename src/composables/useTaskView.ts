import { useViewMode } from './useViewMode'

/**
 * The Board / List choice for task pages (?view=list). The board comes first.
 * The tasks page remembers the last choice; a project always opens on its
 * board (`remember` off), unless its address asks for the list.
 */
export function useTaskView(remember = true) {
  return useViewMode('helpic:task-view', ['board', 'list'] as const, 'board', remember)
}
