import { defineStore } from 'pinia'
import { http } from '@/services/api'
import type { Project, ProjectInput } from '@/types/projects'

interface ProjectsState {
  projects: Project[]
  loaded: boolean
}

/** Projects grouping tasks — shared with a client/freelancer, or a freelancer's personal ones. */
export const useProjectsStore = defineStore('projects', {
  state: (): ProjectsState => ({ projects: [], loaded: false }),

  actions: {
    async fetchProjects(): Promise<Project[]> {
      const { data } = await http.get<{ projects: Project[] }>('/projects')
      this.projects = data.projects ?? []
      this.loaded = true
      return this.projects
    },

    async fetchProject(id: string): Promise<Project> {
      const { data } = await http.get<{ project: Project }>(`/projects/${id}`)
      this.replace(data.project)
      return data.project
    },

    async createProject(input: ProjectInput): Promise<Project> {
      const { data } = await http.post<{ project: Project }>('/projects', input)
      this.projects = [...this.projects, data.project].sort((a, b) => a.name.localeCompare(b.name))
      return data.project
    },

    async updateProject(id: string, input: ProjectInput): Promise<Project> {
      const { data } = await http.put<{ project: Project }>(`/projects/${id}`, input)
      this.replace(data.project)
      return data.project
    },

    async deleteProject(id: string): Promise<void> {
      await http.delete(`/projects/${id}`)
      this.projects = this.projects.filter((p) => p.id !== id)
    },

    replace(project: Project): void {
      const i = this.projects.findIndex((p) => p.id === project.id)
      if (i >= 0) this.projects[i] = project
    },
  },
})
