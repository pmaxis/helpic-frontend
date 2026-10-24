import { describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import ReportHistory from '@/components/reports/ReportHistory.vue'
import ReportKindPicker from '@/components/reports/ReportKindPicker.vue'
import { t } from '@/i18n'
import type { ReportEvent } from '@/types/reports'
import { api, render, status } from '../../../helpers'
import { makeUser } from '../../../fixtures'

const me = makeUser()
let n = 0
const event = (kind: ReportEvent['kind'], data: ReportEvent['data'] = {}): ReportEvent => ({
  id: `e${++n}`,
  actor: { id: n % 2 ? me.id : 'c', name: 'Acme', email: 'a@x' },
  kind,
  data,
  created_at: '2030-02-01T09:00:00Z',
})

describe('ReportHistory', () => {
  it('words each change, reloading with the report', async () => {
    const events = [
      event('created'),
      event('title', { to: 'February' }),
      event('summary'),
      event('kind', { to: 'detailed' }),
      event('kind', { to: 'basic' }),
      event('item_notes', { task: 'Hero' }),
      event('item_removed', { task: 'Footer' }),
      event('sent'),
      event('paid', { tasks: 3 }),
      event('paid'),
      event('other' as ReportEvent['kind']),
    ]
    const server = api({ 'GET /reports/r-1/history': { events } })
    const history = await render(ReportHistory, { props: { reportId: 'r-1', version: 0 }, user: me })
    for (const s of ['“February”', t('report.detailed'), t('report.basic'), '“Hero”', '“Footer”', t('reportHistory.tasks', { n: 3 }, 3), 'Acme', t('common.you_capital')]) {
      expect(history.text()).toContain(s)
    }
    await history.setProps({ version: 1 })
    await flushPromises()
    expect(server.to('GET /reports/r-1/history')).toHaveLength(2)
  })

  it('quietly shows nothing when the history can’t load', async () => {
    api({ 'GET /reports/r-1/history': status(500) })
    const history = await render(ReportHistory, { props: { reportId: 'r-1', version: 0 }, user: me })
    expect(history.findAll('li')).toHaveLength(0)
  })
})

describe('ReportKindPicker', () => {
  it('picks the type with real radios, in every layout', async () => {
    for (const props of [{}, { compact: true }, { inline: true }]) {
      const picker = mount(ReportKindPicker, { props: { modelValue: 'basic' as const, ...props } })
      const radios = picker.findAll('input[type="radio"]')
      expect((radios[0].element as HTMLInputElement).checked).toBe(true)
      await radios[1].setValue(true)
      expect(picker.emitted('update:modelValue')).toEqual([['detailed']])
    }
    const off = mount(ReportKindPicker, { props: { modelValue: 'basic', disabled: true, inline: true } })
    expect(off.text()).toContain(t('reportKind.basicHint'))
    expect(off.findAll('input[disabled]')).toHaveLength(2)
  })
})

describe('PdfPreview', () => {
  it('draws the pages one at a time, with a pager and the arrow keys', async () => {
    vi.resetModules()
    const page = {
      getViewport: ({ scale }: { scale: number }) => ({ width: 595 * scale, height: 842 * scale }),
      render: () => ({ promise: Promise.resolve() }),
    }
    const destroy = vi.fn()
    vi.doMock('pdfjs-dist', () => ({
      GlobalWorkerOptions: {},
      getDocument: () => ({ promise: Promise.resolve({ numPages: 3, getPage: async () => page, destroy }) }),
    }))
    HTMLCanvasElement.prototype.getContext = (() => ({})) as never
    let resized!: (entries: { contentRect: { width: number } }[]) => void
    vi.stubGlobal('ResizeObserver', class {
      constructor(fn: typeof resized) {
        resized = fn
      }
      observe() {}
      disconnect() {}
    })
    const { default: PdfPreview } = await import('@/components/reports/PdfPreview.vue')
    const preview = mount(PdfPreview, { props: { data: new ArrayBuffer(4) }, attachTo: document.body })
    resized([{ contentRect: { width: 400 } }])
    await vi.waitFor(() => expect(preview.findAll('canvas')).toHaveLength(1))
    expect(preview.emitted('pages')).toEqual([[3]])
    expect(preview.text()).toContain(t('pdfPreview.pageOf', { n: 1, total: 3 }))

    await preview.get(`[aria-label="${t('pdfPreview.next')}"]`).trigger('click')
    expect(preview.text()).toContain(t('pdfPreview.pageOf', { n: 2, total: 3 }))
    await preview.get(`[aria-label="${t('pdfPreview.aria')}"]`).trigger('keydown', { key: 'ArrowRight' })
    await preview.get(`[aria-label="${t('pdfPreview.aria')}"]`).trigger('keydown', { key: 'PageDown' })
    expect(preview.text()).toContain(t('pdfPreview.pageOf', { n: 3, total: 3 }))
    await preview.get(`[aria-label="${t('pdfPreview.aria')}"]`).trigger('keydown', { key: 'Home' })
    await preview.get(`[aria-label="${t('pdfPreview.page', { n: 1 })}"]`).trigger('click')
    await preview.get(`[aria-label="${t('pdfPreview.prev')}"]`).trigger('click')
    expect(preview.text()).toContain(t('pdfPreview.pageOf', { n: 1, total: 3 }))

    resized([{ contentRect: { width: 400 } }])
    resized([{ contentRect: { width: 500 } }])
    await preview.setProps({ data: new ArrayBuffer(4) })
    await flushPromises()
    preview.unmount()
    expect(destroy).toHaveBeenCalled()
    vi.unstubAllGlobals()
    vi.doUnmock('pdfjs-dist')
  })
})
