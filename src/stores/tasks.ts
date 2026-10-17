import { defineStore } from 'pinia'
import { http } from '@/services/api'
import type { Task, TaskInput, TaskPriority, TaskStatus } from '@/types/tasks'

interface TasksState {
  tasks: Task[]
  isLoading: boolean
}

/** Tasks a client sets for a freelancer — both sides use the same endpoints. */
export const useTasksStore = defineStore('tasks', {
  state: (): TasksState => ({ tasks: [], isLoading: false }),

  actions: {
    async fetchTasks(params: { statuses?: TaskStatus[]; with?: string; project?: string } = {}): Promise<void> {
      this.isLoading = true
      try {
        const { data } = await http.get<{ tasks: Task[] }>('/tasks', {
          params: {
            status: params.statuses?.length ? params.statuses.join(',') : undefined,
            with: params.with || undefined,
            project: params.project || undefined,
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

    /** Sets the task's price ("1200.50"), or clears it with null. Freelancer only. */
    async setPrice(id: string, price: string | null): Promise<Task> {
      const { data } = await http.put<{ task: Task }>(`/tasks/${id}/price`, { price })
      this.replace(data.task)
      return data.task
    },

    /** Either side may, in any status. */
    async setPriority(id: string, priority: TaskPriority): Promise<Task> {
      const { data } = await http.put<{ task: Task }>(`/tasks/${id}/priority`, { priority })
      this.replace(data.task)
      return data.task
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
