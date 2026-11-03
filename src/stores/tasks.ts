import { defineStore } from 'pinia'
import { http } from '@/services/api'
import type { Task, TaskBilling, TaskInput, TaskPriority, TaskStatus } from '@/types/tasks'

interface TasksState {
  tasks: Task[]
  isLoading: boolean
  /** How many tasks wait in the backlog of `backlogProject` ('' = every one); null until counted. */
  backlogCount: number | null
  backlogProject: string
}

/** Tasks a client sets for a freelancer — both sides use the same endpoints. */
export const useTasksStore = defineStore('tasks', {
  state: (): TasksState => ({ tasks: [], isLoading: false, backlogCount: null, backlogProject: '' }),

  actions: {
    /** Loads the user's tasks; `backlog` keeps only the ones waiting in a backlog, the most urgent first. */
    async fetchTasks(params: { statuses?: TaskStatus[]; with?: string; project?: string; backlog?: boolean } = {}): Promise<void> {
      this.isLoading = true
      try {
        const { data } = await http.get<{ tasks: Task[] }>('/tasks', {
          params: {
            status: params.statuses?.length ? params.statuses.join(',') : undefined,
            with: params.with || undefined,
            project: params.project || undefined,
            backlog: params.backlog ? 1 : undefined,
          },
        })
        this.tasks = data.tasks ?? []
      } finally {
        this.isLoading = false
      }
    },

    async fetchTask(id: string): Promise<Task> {
      const { data } = await http.get<{ task: Task }>(`/tasks/${id}`)
      this.replace(data.task)
      return data.task
    },

    /** A task's subtasks the user sees, archived ones too, the oldest first. */
    async fetchSubtasks(id: string): Promise<Task[]> {
      const { data } = await http.get<{ tasks: Task[] }>(`/tasks/${id}/subtasks`)
      return data.tasks ?? []
    },

    async createTask(input: TaskInput): Promise<Task> {
      const { data } = await http.post<{ task: Task }>('/tasks', input)
      this.tasks = [data.task, ...this.tasks]
      return data.task
    },

    async updateTask(id: string, input: TaskInput): Promise<Task> {
      const { data } = await http.put<{ task: Task }>(`/tasks/${id}`, input)
      this.replace(data.task)
      return data.task
    },

    /**
     * Sets the task's price ("1200.50"), or clears it with null; billed by the
     * hour, the price follows its time instead. Freelancer only.
     */
    async setPrice(id: string, price: string | null, billing: TaskBilling = 'fixed'): Promise<Task> {
      const { data } = await http.put<{ task: Task }>(`/tasks/${id}/price`, { billing, price })
      this.replace(data.task)
      return data.task
    },

    /** Sets how long the freelancer expects the task to take, in seconds; null clears it. Freelancer only. */
    async setEstimateTime(id: string, seconds: number | null): Promise<Task> {
      const { data } = await http.put<{ task: Task }>(`/tasks/${id}/estimate-time`, { seconds })
      this.replace(data.task)
      return data.task
    },

    /** Sends the task's estimate, as it is now, to its client to approve. */
    async sendEstimate(id: string): Promise<Task> {
      const { data } = await http.post<{ task: Task }>(`/tasks/${id}/estimate`)
      this.replace(data.task)
      return data.task
    },

    /** Takes back an estimate the client hasn't answered. */
    async withdrawEstimate(id: string): Promise<Task> {
      const { data } = await http.delete<{ task: Task }>(`/tasks/${id}/estimate`)
      this.replace(data.task)
      return data.task
    },

    /** The client approves the estimate, or asks for changes saying what. */
    async reviewEstimate(id: string, review: 'approved' | 'changes_requested', note = ''): Promise<Task> {
      const { data } = await http.put<{ task: Task }>(`/tasks/${id}/estimate/review`, { review, note })
      this.replace(data.task)
      return data.task
    },

    /** Either side may, in any status. */
    async setPriority(id: string, priority: TaskPriority): Promise<Task> {
      const { data } = await http.put<{ task: Task }>(`/tasks/${id}/priority`, { priority })
      this.replace(data.task)
      return data.task
    },

    /** Puts the task into its board's backlog, or back on the board in its status's column. */
    async setBacklog(id: string, inBacklog: boolean): Promise<Task> {
      const { data } = await http.put<{ task: Task }>(`/tasks/${id}/backlog`, { in_backlog: inBacklog })
      this.replace(data.task)
      void this.countBacklog()
      return data.task
    },

    /**
     * Counts the tasks waiting in a project's backlog (every project's with
     * ''), for the backlog button's badge; without a project it recounts the
     * last one. A failed count leaves the badge as it was.
     */
    async countBacklog(project?: string): Promise<void> {
      if (project !== undefined) this.backlogProject = project
      const asked = this.backlogProject
      try {
        const { data } = await http.get<{ tasks: Task[] }>('/tasks', { params: { backlog: 1, project: asked || undefined } })
        // a later count for another project wins
        if (asked === this.backlogProject) this.backlogCount = (data.tasks ?? []).length
      } catch {
        // the badge just isn't updated
      }
    },

    /** Replaces the task's labels with these, from its board. */
    async setLabels(id: string, labelIds: string[]): Promise<Task> {
      const { data } = await http.put<{ task: Task }>(`/tasks/${id}/labels`, { label_ids: labelIds })
      this.replace(data.task)
      return data.task
    },

    /** Puts the task into an exact workflow status (board column). */
    async moveToStatus(id: string, statusId: string): Promise<Task> {
      const { data } = await http.post<{ task: Task }>(`/tasks/${id}/status`, { status_id: statusId })
      this.replace(data.task)
      return data.task
    },

    /** Puts the user's own personal task in the archive, for good. */
    async archiveTask(id: string): Promise<Task> {
      const { data } = await http.post<{ task: Task }>(`/tasks/${id}/archive`)
      this.tasks = this.tasks.filter((t) => t.id !== id)
      return data.task
    },

    async deleteTask(id: string): Promise<void> {
      await http.delete(`/tasks/${id}`)
      this.tasks = this.tasks.filter((t) => t.id !== id)
    },

    replace(task: Task): void {
      const i = this.tasks.findIndex((t) => t.id === task.id)
      if (i >= 0) this.tasks[i] = task
    },
  },
})
