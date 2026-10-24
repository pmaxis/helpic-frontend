import { describe, expect, it, vi } from 'vitest'
import { http } from '@/services/api'
import { useReportsStore } from '@/stores/reports'
import { makeReport } from '../../fixtures'

describe('reports store', () => {
  it('loads the list', async () => {
    const reports = useReportsStore()
    vi.spyOn(http, 'get').mockResolvedValue({ data: { reports: [makeReport()] } })
    await reports.fetchReports()
    expect([reports.reports.length, reports.loaded]).toEqual([1, true])
  })

  it.each([
    ['createReport', (s: ReturnType<typeof useReportsStore>) => s.createReport({ from: '2030-01-01', to: '2030-01-31' }), 'post', '/reports'],
    ['markPaid', (s: ReturnType<typeof useReportsStore>) => s.markPaid('r-1'), 'post', '/reports/r-1/paid'],
    ['sendReport', (s: ReturnType<typeof useReportsStore>) => s.sendReport('r-1'), 'post', '/reports/r-1/send'],
  ] as const)('%s marks the list stale', async (_name, call, method, url) => {
    const reports = useReportsStore()
    reports.loaded = true
    const spy = vi.spyOn(http, method).mockResolvedValue({ data: { report: makeReport() } })
    await call(reports)
    expect(spy.mock.calls[0][0]).toBe(url)
    expect(reports.loaded).toBe(false)
  })

  it.each([
    ['fetchReport', (s: ReturnType<typeof useReportsStore>) => s.fetchReport('r-1'), 'get', '/reports/r-1'],
    ['updateReport', (s: ReturnType<typeof useReportsStore>) => s.updateReport('r-1', { title: 'T', summary: '' }), 'put', '/reports/r-1'],
    ['updateItemNotes', (s: ReturnType<typeof useReportsStore>) => s.updateItemNotes('r-1', 'i-1', 'n'), 'put', '/reports/r-1/items/i-1'],
    ['removeItem', (s: ReturnType<typeof useReportsStore>) => s.removeItem('r-1', 'i-1'), 'delete', '/reports/r-1/items/i-1'],
  ] as const)('%s returns the report the backend sends', async (_name, call, method, url) => {
    const reports = useReportsStore()
    const spy = vi.spyOn(http, method).mockResolvedValue({ data: { report: makeReport({ title: 'Back' }) } })
    expect((await call(reports)).title).toBe('Back')
    expect(spy.mock.calls[0][0]).toBe(url)
  })

  it('loads the history, empty when there is none', async () => {
    const reports = useReportsStore()
    vi.spyOn(http, 'get').mockResolvedValue({ data: {} })
    expect(await reports.fetchHistory('r-1')).toEqual([])
  })

  it('takes a deleted report off the list', async () => {
    const reports = useReportsStore()
    reports.reports = [makeReport({ id: 'a' }), makeReport({ id: 'b' })]
    vi.spyOn(http, 'delete').mockResolvedValue({ data: {} })
    await reports.deleteReport('a')
    expect(reports.reports.map((r) => r.id)).toEqual(['b'])
  })
})
