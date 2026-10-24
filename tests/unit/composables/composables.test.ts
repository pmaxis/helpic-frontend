import { afterEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick, ref } from 'vue'
import { mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import { toast, useToasts } from '@/composables/useToasts'
import { useStatusFilter } from '@/composables/useStatusFilter'
import { useViewMode } from '@/composables/useViewMode'
import { useTaskView } from '@/composables/useTaskView'
import { http } from '@/services/api'
import { linkToken } from '@/utils/linkToken'
import { makeColumn, makeTask } from '../../fixtures'

afterEach(() => {
  vi.useRealTimers()
  useToasts().toasts.splice(0)
})

/** Runs a composable inside a component, with a router at path, and gives back what it returned. */
async function withSetup<T>(use: () => T, path = '/tasks') {
  const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/:p(.*)*', component: { render: () => null } }] })
  await router.push(path)
  let result!: T
  mount(defineComponent({ setup: () => ((result = use()), () => h('div')) }), { global: { plugins: [router] } })
  return { result, router }
}

describe('useToasts', () => {
  it('queues toasts and drops each when its time is up; errors stay longer', () => {
    vi.useFakeTimers()
    const { toasts, dismiss } = useToasts()
    toast.success('Saved')
    toast.error('Failed')
    toast.info('Sticky', 0)
    expect(toasts.map((t) => t.tone)).toEqual(['success', 'error', 'info'])
    vi.advanceTimersByTime(4000)
    expect(toasts.map((t) => t.message)).toEqual(['Failed', 'Sticky'])
    vi.advanceTimersByTime(2000)
    expect(toasts.map((t) => t.message)).toEqual(['Sticky'])
    dismiss(toasts[0].id)
    expect(toasts).toHaveLength(0)
  })
})

describe('useStatusFilter', () => {
  it('shows every task until columns are picked, then those in them', async () => {
    vi.spyOn(http, 'get').mockResolvedValue({
      data: { can_manage: true, columns: [makeColumn({ id: 'todo', category: 'new' }), makeColumn({ id: 'done', name: 'Done', category: 'done' })] },
    })
    const project = ref('p1')
    const { result: filter } = await withSetup(() => useStatusFilter(project))
    await filter.load()
    expect(filter.options.map((o) => o.value)).toEqual(['todo', 'done'])

    const tasks = [makeTask({ id: 'a', status_id: 'todo' }), makeTask({ id: 'b', status_id: 'done' })]
    expect(filter.visible(tasks)).toHaveLength(2)
    filter.selectBucket('done')
    expect(filter.visible(tasks).map((t) => t.id)).toEqual(['b'])
  })

  it('drops picks that aren’t columns any more, and everything without a project', async () => {
    const get = vi.spyOn(http, 'get').mockResolvedValue({ data: { can_manage: true, columns: [makeColumn({ id: 'todo' })] } })
    const project = ref('p1')
    const { result: filter } = await withSetup(() => useStatusFilter(project))
    filter.selected = ['todo', 'gone']
    await filter.load()
    expect(filter.selected).toEqual(['todo'])

    project.value = ''
    await filter.load()
    expect([filter.options, filter.selected]).toEqual([[], []])
    expect(get).toHaveBeenCalledOnce()
  })
})

describe('useViewMode', () => {
  it('takes the view from the URL first, then this browser, then the default', async () => {
    expect((await withSetup(() => useTaskView(), '/tasks?view=board')).result.value).toBe('board')
    expect((await withSetup(() => useTaskView())).result.value).toBe('board')
    localStorage.clear()
    expect((await withSetup(() => useTaskView())).result.value).toBe('list')
    expect((await withSetup(() => useTaskView(), '/tasks?view=nonsense')).result.value).toBe('list')
  })

  it('puts a change in the URL and remembers it', async () => {
    const { result: view, router } = await withSetup(() => useViewMode('helpic:test-view', ['cards', 'list'] as const, 'cards'))
    view.value = 'list'
    await nextTick()
    await new Promise((r) => setTimeout(r))
    expect(router.currentRoute.value.query.view).toBe('list')
    expect(localStorage.getItem('helpic:test-view')).toBe('list')
  })
})

describe('linkToken', () => {
  it('reads the token from the path, or from an older link’s fragment', () => {
    expect(linkToken({ params: { token: 'abc' } } as never)).toBe('abc')
    window.location.hash = '#old'
    expect(linkToken({ params: {} } as never)).toBe('old')
    window.location.hash = ''
  })
})
