import { describe, expect, it, vi } from 'vitest'
import { http } from '@/services/api'
import { useTasksStore } from '@/stores/tasks'
import { makeTask } from '../../fixtures'

function seeded() {
  const tasks = useTasksStore()
  tasks.tasks = [makeTask({ id: 'a' }), makeTask({ id: 'b' })]
  return tasks
}

describe('tasks store', () => {
  it('loads the list with only the filters that are set', async () => {
    const tasks = useTasksStore()
    const get = vi.spyOn(http, 'get').mockResolvedValue({ data: { tasks: [makeTask()] } })
    await tasks.fetchTasks({ statuses: ['new', 'done'], with: '' })
    expect(get).toHaveBeenCalledWith('/tasks', { params: { status: 'new,done', with: undefined, project: undefined } })
    expect(tasks.tasks).toHaveLength(1)
    expect(tasks.isLoading).toBe(false)

    get.mockResolvedValue({ data: {} })
    await tasks.fetchTasks()
    expect(tasks.tasks).toEqual([])
  })

  it('puts a new task first', async () => {
    const tasks = seeded()
    vi.spyOn(http, 'post').mockResolvedValue({ data: { task: makeTask({ id: 'new' }) } })
    await tasks.createTask({ title: 'New', description: '', due_on: null })
    expect(tasks.tasks.map((t) => t.id)).toEqual(['new', 'a', 'b'])
  })

  it.each([
    ['updateTask', (s: ReturnType<typeof useTasksStore>) => s.updateTask('b', { title: 'X', description: '', due_on: null }), 'put', '/tasks/b'],
    ['setPrice', (s: ReturnType<typeof useTasksStore>) => s.setPrice('b', '10'), 'put', '/tasks/b/price'],
    ['setPriority', (s: ReturnType<typeof useTasksStore>) => s.setPriority('b', 'high'), 'put', '/tasks/b/priority'],
    ['setLabels', (s: ReturnType<typeof useTasksStore>) => s.setLabels('b', ['l']), 'put', '/tasks/b/labels'],
    ['moveToStatus', (s: ReturnType<typeof useTasksStore>) => s.moveToStatus('b', 'c'), 'post', '/tasks/b/status'],
    ['fetchTask', (s: ReturnType<typeof useTasksStore>) => s.fetchTask('b'), 'get', '/tasks/b'],
  ] as const)('%s shows the task the backend returns in the list', async (_name, call, method, url) => {
    const tasks = seeded()
    const spy = vi.spyOn(http, method).mockResolvedValue({ data: { task: makeTask({ id: 'b', title: 'Changed' }) } })
    const task = await call(tasks)
    expect(spy.mock.calls[0][0]).toBe(url)
    expect(task.title).toBe('Changed')
    expect(tasks.tasks[1].title).toBe('Changed')
  })

  it('sends a fixed price by default, and the billing when given', async () => {
    const tasks = seeded()
    const put = vi.spyOn(http, 'put').mockResolvedValue({ data: { task: makeTask({ id: 'b' }) } })
    await tasks.setPrice('b', '10')
    expect(put).toHaveBeenLastCalledWith('/tasks/b/price', { billing: 'fixed', price: '10' })
    await tasks.setPrice('b', null, 'hourly')
    expect(put).toHaveBeenLastCalledWith('/tasks/b/price', { billing: 'hourly', price: null })
  })

  it('takes an archived or deleted task off the list', async () => {
    const tasks = seeded()
    vi.spyOn(http, 'post').mockResolvedValue({ data: { task: makeTask({ id: 'a', archived_at: '2030-01-01' }) } })
    const archived = await tasks.archiveTask('a')
    expect(archived.archived_at).toBe('2030-01-01')
    vi.spyOn(http, 'delete').mockResolvedValue({ data: {} })
    await tasks.deleteTask('b')
    expect(tasks.tasks).toEqual([])
  })

  it('leaves the list alone for a task that isn’t in it', () => {
    const tasks = seeded()
    tasks.replace(makeTask({ id: 'elsewhere' }))
    expect(tasks.tasks.map((t) => t.id)).toEqual(['a', 'b'])
  })
})
