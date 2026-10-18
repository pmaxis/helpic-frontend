import { defineStore } from 'pinia'
import { http } from '@/services/api'
import type { BoardColumn, BoardLabel, BoardResponse, BoardScope, ColumnInput } from '@/types/board'
import type { Task } from '@/types/tasks'

type Lane = BoardColumn & { tasks: Task[] }

interface BoardState {
  columns: Lane[]
  canManage: boolean
  /** The all board: lanes merged from several boards; no column management, no ordering. */
  merged: boolean
  scope: BoardScope
  isLoading: boolean
}

function params(scope: BoardScope) {
  return {
    with: scope.with || undefined,
    project: scope.project || undefined,
    projects: scope.projects?.length ? scope.projects.join(',') : undefined,
  }
}

/** Fetches a board's columns without tasks, e.g. for a task's status picker. */
export async function fetchColumns(scope: BoardScope): Promise<BoardResponse> {
  const { data } = await http.get<BoardResponse>('/board/columns', { params: params(scope) })
  return data
}

/** A board's labels, by name. Both sides of the board make and change them. */
export async function fetchLabels(scope: BoardScope): Promise<BoardLabel[]> {
  const { data } = await http.get<{ labels: BoardLabel[] }>('/board/labels', { params: params(scope) })
  return data.labels ?? []
}

export async function createLabel(scope: BoardScope, name: string, color: string): Promise<BoardLabel> {
  const { data } = await http.post<{ label: BoardLabel }>('/board/labels', { with: scope.with, project_id: scope.project, name, color })
  return data.label
}

export async function updateLabel(id: string, name: string, color: string): Promise<BoardLabel> {
  const { data } = await http.put<{ label: BoardLabel }>(`/board/labels/${id}`, { name, color })
  return data.label
}

export async function deleteLabel(id: string): Promise<void> {
  await http.delete(`/board/labels/${id}`)
}

/**
 * The Jira-style board a freelancer shares with a client: its columns are the
 * pair's workflow statuses. The freelancer manages the columns, and so does
 * the author of a project board; both sides move cards.
 */
export const useBoardStore = defineStore('board', {
  state: (): BoardState => ({ columns: [], canManage: false, merged: false, scope: {}, isLoading: false }),

  actions: {
    /** Loads a board; without a scope it reloads the last one. */
    async fetchBoard(scope?: BoardScope): Promise<void> {
      if (scope) this.scope = scope
      this.isLoading = true
      try {
        const { data } = await http.get<BoardResponse>('/board', { params: params(this.scope) })
        this.columns = (data.columns ?? []).map((c) => ({ ...c, tasks: c.tasks ?? [] }))
        this.canManage = data.can_manage
        this.merged = !!data.merged
      } finally {
        this.isLoading = false
      }
    },

    async createColumn(input: ColumnInput): Promise<void> {
      await http.post('/board/columns', { ...input, with: this.scope.with, project_id: this.scope.project })
      await this.fetchBoard()
    },

    async updateColumn(id: string, input: ColumnInput): Promise<void> {
      await http.put(`/board/columns/${id}`, input)
      await this.fetchBoard()
    },

    async deleteColumn(id: string): Promise<void> {
      await http.delete(`/board/columns/${id}`)
      await this.fetchBoard()
    },

    /** Moves a column one step left (-1) or right (+1). */
    async shiftColumn(id: string, step: -1 | 1): Promise<void> {
      const i = this.columns.findIndex((c) => c.id === id)
      if (i < 0) return
      await this.moveColumn(id, step < 0 ? i - 1 : i + 2)
    },

    /**
     * Moves a column so it lands before the column now at index `to`
     * (columns.length = the end). Shown right away; a failed save reloads.
     */
    async moveColumn(id: string, to: number): Promise<void> {
      const from = this.columns.findIndex((c) => c.id === id)
      if (from < 0 || to < 0 || to > this.columns.length) return
      const at = to > from ? to - 1 : to
      if (at === from) return
      const next = [...this.columns]
      const [col] = next.splice(from, 1)
      next.splice(at, 0, col)
      this.columns = next
      try {
        await http.put('/board/columns', { ids: next.map((c) => c.id) })
      } catch (error) {
        await this.fetchBoard()
        throw error
      }
    },

    /**
     * Shows an edited task in place. A task moved out of the project whose
     * board this is leaves the board.
     */
    replaceTask(task: Task): void {
      for (const col of this.columns) {
        const i = col.tasks.findIndex((t) => t.id === task.id)
        if (i < 0) continue
        if (this.scope.project && task.project?.id !== this.scope.project) col.tasks.splice(i, 1)
        else col.tasks[i] = task
        return
      }
    },

    /**
     * Puts a task into a column at an index, right away on screen, then asks
     * the backend. A refused move (e.g. a client can't mark a task done) puts
     * the board back as it was.
     */
    async moveTask(taskId: string, columnId: string, index: number): Promise<void> {
      const from = this.columns.find((c) => c.tasks.some((t) => t.id === taskId))
      const to = this.columns.find((c) => c.id === columnId)
      if (!from || !to) return
      const task = from.tasks.find((t) => t.id === taskId) as Task
      const before = this.columns.map((c) => ({ ...c, tasks: [...c.tasks] }))

      from.tasks = from.tasks.filter((t) => t.id !== taskId)
      const target = to.tasks.filter((t) => t.id !== taskId)
      const at = Math.max(0, Math.min(index, target.length))
      const afterTaskId = at > 0 ? target[at - 1].id : ''
      target.splice(at, 0, { ...task, status_id: to.id, status_name: to.name, status: to.category })
      to.tasks = target

      try {
        // On the all board a column is a lane; the server finds the task's own column for it.
        const { data } = await http.post<{ task: Task }>(
          '/board/moves',
          this.merged ? { task_id: taskId, lane: columnId } : { task_id: taskId, column_id: columnId, after_task_id: afterTaskId },
        )
        const i = to.tasks.findIndex((t) => t.id === taskId)
        if (i >= 0) to.tasks[i] = data.task
      } catch (error) {
        this.columns = before
        throw error
      }
    },
  },
})
