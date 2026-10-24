import { describe, expect, it, vi } from 'vitest'
import { http } from '@/services/api'
import { useProjectsStore } from '@/stores/projects'
import { makeProject } from '../../fixtures'

describe('projects store', () => {
  it('loads the projects and remembers it did', async () => {
    const projects = useProjectsStore()
    vi.spyOn(http, 'get').mockResolvedValue({ data: { projects: [makeProject()] } })
    expect(await projects.fetchProjects()).toHaveLength(1)
    expect(projects.loaded).toBe(true)
  })

  it('keeps the list sorted by name after a new project', async () => {
    const projects = useProjectsStore()
    projects.projects = [makeProject({ id: 'b', name: 'Beta' }), makeProject({ id: 'z', name: 'Zeta' })]
    vi.spyOn(http, 'post').mockResolvedValue({ data: { project: makeProject({ id: 'a', name: 'Alpha' }) } })
    await projects.createProject({ name: 'Alpha', description: '' })
    expect(projects.projects.map((p) => p.name)).toEqual(['Alpha', 'Beta', 'Zeta'])
  })

  it('replaces a project in place, or adds one it hasn’t seen', async () => {
    const projects = useProjectsStore()
    projects.projects = [makeProject({ id: 'a', name: 'Old' })]
    vi.spyOn(http, 'put').mockResolvedValue({ data: { project: makeProject({ id: 'a', name: 'New' }) } })
    await projects.updateProject('a', { name: 'New', description: '' })
    expect(projects.projects[0].name).toBe('New')

    vi.spyOn(http, 'get').mockResolvedValue({ data: { project: makeProject({ id: 'b' }) } })
    await projects.fetchProject('b')
    expect(projects.projects.map((p) => p.id)).toEqual(['a', 'b'])
  })

  it('sets the viewer’s rate and deletes a project', async () => {
    const projects = useProjectsStore()
    projects.projects = [makeProject({ id: 'a' })]
    const put = vi.spyOn(http, 'put').mockResolvedValue({ data: { project: makeProject({ id: 'a', my_hourly_rate_cents: 5000 }) } })
    await projects.setRate('a', '50')
    expect(put).toHaveBeenCalledWith('/projects/a/rate', { rate: '50' })
    expect(projects.projects[0].my_hourly_rate_cents).toBe(5000)

    vi.spyOn(http, 'delete').mockResolvedValue({ data: {} })
    await projects.deleteProject('a')
    expect(projects.projects).toEqual([])
  })
})
