import { beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest'
import { http } from '@/services/api'
import { useBoardStore } from '@/stores/board'
import { makeColumn, makeTask } from '../../fixtures'

/** A board of three columns; the first holds tasks a and b. */
function seed() {
  const board = useBoardStore()
  board.columns = [
    makeColumn({ id: 'todo', name: 'To do', category: 'new', tasks: [makeTask({ id: 'a', status_id: 'todo' }), makeTask({ id: 'b', status_id: 'todo' })] }),
    makeColumn({ id: 'doing', name: 'Doing', category: 'in_progress', tasks: [makeTask({ id: 'c', status_id: 'doing', status: 'in_progress' })] }),
    makeColumn({ id: 'done', name: 'Done', category: 'done' }),
  ]
  return board
}

const ids = (list: { id: string }[]) => list.map((x) => x.id)

describe('moveColumn', () => {
  let put: MockInstance<typeof http.put>

  beforeEach(() => {
    put = vi.spyOn(http, 'put').mockResolvedValue({ data: {} })
  })

  it('puts the column before the one at the index and saves the order', async () => {
    const board = seed()
    await board.moveColumn('done', 0)
    expect(ids(board.columns)).toEqual(['done', 'todo', 'doing'])
    expect(put).toHaveBeenCalledWith('/board/columns', { ids: ['done', 'todo', 'doing'] })
  })

  it('moves to the end with the length as the index', async () => {
    const board = seed()
    await board.moveColumn('todo', 3)
    expect(ids(board.columns)).toEqual(['doing', 'done', 'todo'])
  })

  it('sends nothing when the column would land where it is', async () => {
    const board = seed()
    await board.moveColumn('doing', 1)
    await board.moveColumn('doing', 2)
    expect(put).not.toHaveBeenCalled()
  })

  it('reloads the board when the order is refused', async () => {
    const board = seed()
    put.mockRejectedValue(new Error('refused'))
    const get = vi.spyOn(http, 'get').mockResolvedValue({ data: { can_manage: true, columns: [makeColumn({ id: 'server' })] } })
    await expect(board.moveColumn('done', 0)).rejects.toThrow('refused')
    expect(get).toHaveBeenCalledWith('/board', expect.anything())
    expect(ids(board.columns)).toEqual(['server'])
  })

  it('shifts a column one step either way', async () => {
    const board = seed()
    await board.shiftColumn('doing', 1)
    expect(ids(board.columns)).toEqual(['todo', 'done', 'doing'])
    await board.shiftColumn('doing', -1)
    expect(ids(board.columns)).toEqual(['todo', 'doing', 'done'])
  })
})

describe('moveTask', () => {
  it('shows the card in its new column at once, then takes the server’s task', async () => {
    const board = seed()
    let answer!: (value: unknown) => void
    const post = vi.spyOn(http, 'post').mockReturnValue(new Promise((resolve) => (answer = resolve)))

    const moving = board.moveTask('a', 'doing', 1)
    expect(ids(board.columns[0].tasks)).toEqual(['b'])
    expect(ids(board.columns[1].tasks)).toEqual(['c', 'a'])
    expect(board.columns[1].tasks[1]).toMatchObject({ status_id: 'doing', status: 'in_progress', status_name: 'Doing' })
    expect(post).toHaveBeenCalledWith('/board/moves', { task_id: 'a', column_id: 'doing', after_task_id: 'c' })

    answer({ data: { task: makeTask({ id: 'a', status_id: 'doing', title: 'From the server' }) } })
    await moving
    expect(board.columns[1].tasks[1].title).toBe('From the server')
  })

  it('puts the board back as it was when the move is refused', async () => {
    const board = seed()
    vi.spyOn(http, 'post').mockRejectedValue(new Error('not allowed'))
    await expect(board.moveTask('a', 'done', 0)).rejects.toThrow('not allowed')
    expect(ids(board.columns[0].tasks)).toEqual(['a', 'b'])
    expect(board.columns[2].tasks).toEqual([])
  })

  it('names the lane, not a column, on the merged board', async () => {
    const board = seed()
    board.merged = true
    const post = vi.spyOn(http, 'post').mockResolvedValue({ data: { task: makeTask({ id: 'a' }) } })
    await board.moveTask('a', 'done', 0)
    expect(post).toHaveBeenCalledWith('/board/moves', { task_id: 'a', lane: 'done' })
  })
})

describe('replaceTask', () => {
  it('shows an edited task in place', () => {
    const board = seed()
    board.replaceTask(makeTask({ id: 'b', status_id: 'todo', title: 'Renamed' }))
    expect(board.columns[0].tasks[1].title).toBe('Renamed')
  })

  it('drops a task moved out of the project whose board this is', () => {
    const board = seed()
    board.scope = { project: 'p-1' }
    board.replaceTask(makeTask({ id: 'b', project: { id: 'p-2', name: 'Other' } }))
    expect(ids(board.columns[0].tasks)).toEqual(['a'])
  })
})

describe('fetchBoard and the columns', () => {
  it('loads a board, remembering its scope for the next reload', async () => {
    const board = useBoardStore()
    const get = vi.spyOn(http, 'get').mockResolvedValue({ data: { can_manage: true, merged: true, columns: [makeColumn({ tasks: undefined })] } })
    await board.fetchBoard({ projects: ['a', 'b'] })
    expect(get).toHaveBeenLastCalledWith('/board', { params: { with: undefined, project: undefined, projects: 'a,b' } })
    expect([board.canManage, board.merged, board.columns[0].tasks]).toEqual([true, true, []])

    await board.fetchBoard()
    expect(get).toHaveBeenLastCalledWith('/board', { params: { with: undefined, project: undefined, projects: 'a,b' } })
    expect(board.isLoading).toBe(false)
  })

  it('reloads the board after a column is added, changed or deleted', async () => {
    const board = useBoardStore()
    board.scope = { with: 'c1' }
    const get = vi.spyOn(http, 'get').mockResolvedValue({ data: { can_manage: true, columns: [] } })
    const post = vi.spyOn(http, 'post').mockResolvedValue({ data: {} })
    vi.spyOn(http, 'put').mockResolvedValue({ data: {} })
    vi.spyOn(http, 'delete').mockResolvedValue({ data: {} })

    await board.createColumn({ name: 'QA', status_category: 'in_progress' })
    expect(post).toHaveBeenCalledWith('/board/columns', { name: 'QA', status_category: 'in_progress', with: 'c1', project_id: undefined })
    await board.updateColumn('c', { name: 'Review' })
    await board.deleteColumn('c')
    expect(get).toHaveBeenCalledTimes(3)
  })

  it('does nothing for a column or task it doesn’t have', async () => {
    const board = seed()
    const put = vi.spyOn(http, 'put')
    const post = vi.spyOn(http, 'post')
    await board.shiftColumn('missing', 1)
    await board.moveColumn('todo', 9)
    await board.moveTask('missing', 'done', 0)
    expect(put).not.toHaveBeenCalled()
    expect(post).not.toHaveBeenCalled()
  })
})
