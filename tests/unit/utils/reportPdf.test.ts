import { afterEach, describe, expect, it, vi } from 'vitest'
import { makeReport } from '../../fixtures'
import { api, status } from '../../helpers'

const pdfmake = vi.hoisted(() => ({
  setUrlAccessPolicy: vi.fn(),
  addFonts: vi.fn(),
  // jsdom's Blob has no arrayBuffer(); a browser's does
  createPdf: vi.fn(() => ({ getBlob: async () => ({ arrayBuffer: async () => new TextEncoder().encode('%PDF').buffer }) })),
}))
vi.mock('pdfmake', () => ({ default: pdfmake }))

afterEach(() => {
  vi.useRealTimers()
})

describe('renderReportPdf', () => {
  it('loads pdfmake once with Inter, fetching fonts only from this site, and prints the report', async () => {
    const { renderReportPdf } = await import('@/utils/reportPdf')
    const first = await renderReportPdf(makeReport({ title: 'January' }))
    await renderReportPdf(makeReport(), { inUAH: true })
    expect(new TextDecoder().decode(first)).toBe('%PDF')
    expect(pdfmake.addFonts).toHaveBeenCalledOnce()
    const fonts = pdfmake.addFonts.mock.calls[0][0] as Record<string, { normal: string }>
    expect(Object.keys(fonts)).toEqual(['Inter', 'InterMedium', 'InterSemiBold'])
    expect(fonts.Inter.normal.startsWith(location.origin)).toBe(true)
    const policy = pdfmake.setUrlAccessPolicy.mock.calls[0][0] as (url: string) => boolean
    expect(policy(`${location.origin}/font.ttf`)).toBe(true)
    expect(policy('https://evil.example/font.ttf')).toBe(false)
    expect(pdfmake.createPdf).toHaveBeenCalledTimes(2)
  })
})

describe('renderReportPdf › logo', () => {
  it('prints the report’s logo, fetching each one once, and prints without it when it can’t be had', async () => {
    const { renderReportPdf } = await import('@/utils/reportPdf')
    const server = api({ 'GET /reports/r-1/logo': new Blob(['png'], { type: 'image/png' }), 'GET /reports/r-2/logo': status(500) })
    pdfmake.createPdf.mockClear()
    const branding = { color: null, details: '', logo_id: 'logo-a' }
    await renderReportPdf(makeReport({ branding }))
    await renderReportPdf(makeReport({ branding }))
    expect(server.to('GET /reports/r-1/logo')).toHaveLength(1)
    const doc = pdfmake.createPdf.mock.calls[0] as unknown as [{ content: { image?: string }[] }]
    expect(doc[0].content[0].image).toMatch(/^data:image\/png;base64,/)

    await renderReportPdf(makeReport({ id: 'r-2', branding: { ...branding, logo_id: 'logo-b' } }))
    const plain = pdfmake.createPdf.mock.calls[2] as unknown as [{ content: { image?: string }[] }]
    expect(plain[0].content[0].image).toBeUndefined()
  })
})

describe('savePdf', () => {
  it('downloads the file under its name, freeing its URL after', async () => {
    vi.useFakeTimers()
    const { savePdf } = await import('@/utils/reportPdf')
    URL.createObjectURL = vi.fn(() => 'blob:pdf')
    URL.revokeObjectURL = vi.fn()
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    savePdf(new ArrayBuffer(4), 'January.pdf')
    expect(click.mock.contexts[0]).toMatchObject({ download: 'January.pdf', href: 'blob:pdf' })
    expect(document.querySelector('a[download]')).toBeNull()
    vi.advanceTimersByTime(1000)
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:pdf')
  })
})
