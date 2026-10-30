import { describe, expect, it } from 'vitest'
import { buildSheet, splitBlocks } from '@/utils/reportSheet'
import { pdfFileName } from '@/utils/reportPdf'
import { reportDocument } from '@/utils/reportDocument'
import { makeReport, makeReportItem } from '../../fixtures'

describe('splitBlocks', () => {
  it('keeps one plain line as a paragraph', () => {
    expect(splitBlocks('  Built the landing page. ')).toEqual([{ text: 'Built the landing page.' }])
    expect(splitBlocks('')).toEqual([])
  })

  it('turns marked lines, or a block of plain ones, into a list without the markers', () => {
    expect(splitBlocks('- Design\n• Copy\n\n—Launch')).toEqual([{ items: ['Design', 'Copy'], ordered: false }, { text: '—Launch' }])
    expect(splitBlocks('* Just one')).toEqual([{ items: ['Just one'], ordered: false }])
    expect(splitBlocks('Site: filters\nApp: onboarding\nNext: payments')).toEqual([
      { items: ['Site: filters', 'App: onboarding', 'Next: payments'], ordered: false },
    ])
    expect(splitBlocks('1. Brief\n2) Mockups')).toEqual([{ items: ['Brief', 'Mockups'], ordered: true }])
  })

  it('keeps paragraphs apart and a list in one piece across blank lines', () => {
    const summary = 'Two weeks of work on the site.\n\nThe results:\n\n- Faster tables\n\n- New reviews block\n\nEverything planned is done.'
    expect(splitBlocks(summary)).toEqual([
      { text: 'Two weeks of work on the site.' },
      { text: 'The results:' },
      { items: ['Faster tables', 'New reviews block'], ordered: false },
      { text: 'Everything planned is done.' },
    ])
    // a plain line among marked ones stays text
    expect(splitBlocks('Done:\n- Hero\n- Footer')).toEqual([{ text: 'Done:' }, { items: ['Hero', 'Footer'], ordered: false }])
  })
})

describe('buildSheet', () => {
  it('marks only a client’s unsent report as a draft', () => {
    expect(buildSheet(makeReport()).draft).toBe(true)
    expect(buildSheet(makeReport({ client: null })).draft).toBe(false)
    expect(buildSheet(makeReport({ status: 'sent' })).draft).toBe(false)
  })

  it('states the period, the projects and the count of tasks', () => {
    const sheet = buildSheet(makeReport({ projects: [{ id: 'p', name: 'Landing' }], items: [makeReportItem()] }))
    expect(sheet.facts).toEqual([expect.stringMatching(/^1\s?–\s?31 Jan 2030$/), 'Landing', '1 task completed'])
  })

  it('shows the price, time and project columns only when there is something in them', () => {
    const bare = buildSheet(makeReport({ items: [makeReportItem()] }))
    expect([bare.showPrice, bare.showTime, bare.showProject, bare.total]).toEqual([false, false, false, ''])

    const full = buildSheet(
      makeReport({
        total_cents: 12000,
        items: [makeReportItem({ price_cents: 12000, seconds: 5400, project_name: 'Landing' })],
      }),
    )
    expect([full.showPrice, full.showTime, full.showProject, full.total]).toEqual([true, true, true, '$120.00'])
    expect(full.items[0]).toMatchObject({ price: '$120.00', time: '1h 30m', completed: '20 Jan 2030' })
  })

  it('adds hryvnias only when asked and the report has a rate', () => {
    const report = makeReport({
      total_cents: 10000,
      in_uah: { rate: '41.5', rate_on: '2030-02-01', total_cents: 415000 },
      items: [makeReportItem({ price_cents: 10000, price_in_uah_cents: 415000 })],
    })
    expect(buildSheet(report).totalInUAH).toBe('')
    const sheet = buildSheet(report, { inUAH: true })
    expect(sheet.totalInUAH).toBe('(~ ₴4,150.00)')
    expect(sheet.items[0].priceInUAH).toBe('(~ ₴4,150.00)')
  })

  it('carries each task’s notes only in a detailed report', () => {
    const items = [makeReportItem({ notes: '- Hero\n- Footer' })]
    expect(buildSheet(makeReport({ items })).items[0].notes).toEqual([])
    expect(buildSheet(makeReport({ kind: 'detailed', items })).items[0].notes).toEqual([{ items: ['Hero', 'Footer'], ordered: false }])
  })

  it('dates the footer and signs it with the freelancer', () => {
    const sheet = buildSheet(makeReport({ status: 'paid', sent_at: '2030-02-02T09:00:00Z', paid_at: '2030-02-10T09:00:00Z' }))
    expect(sheet.footerLeft).toBe('Prepared 1 Feb 2030 · sent 2 Feb 2030 · paid 10 Feb 2030 · Helpic')
    expect(sheet.footerRight).toBe('Olena Freelancer (olena@example.test)')
    expect(buildSheet(makeReport({ freelancer: { id: 'f', name: '', email: 'f@example.test' } })).footerRight).toBe('f@example.test')
  })
})

describe('reportDocument', () => {
  it('lays the sheet out on A4, its title among the content', () => {
    const doc = reportDocument(buildSheet(makeReport({ title: 'January work', items: [makeReportItem()] })))
    expect(doc.pageSize).toBe('A4')
    expect(JSON.stringify(doc.content)).toContain('January work')
  })
})

describe('pdfFileName', () => {
  it('turns characters a file name can’t hold into spaces', () => {
    expect(pdfFileName('Jan: work / fixes?')).toBe('Jan work fixes.pdf')
    expect(pdfFileName(' *** ')).toBe('Work report.pdf')
  })
})
