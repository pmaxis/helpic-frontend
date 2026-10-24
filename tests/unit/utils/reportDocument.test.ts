import { describe, expect, it } from 'vitest'
import type { ContentTable, TDocumentDefinitions } from 'pdfmake/interfaces'
import { reportDocument } from '@/utils/reportDocument'
import { buildSheet } from '@/utils/reportSheet'
import { makeReport, makeReportItem } from '../../fixtures'
import type { Report } from '@/types/reports'

function documentOf(over: Partial<Report> = {}, inUAH = false): TDocumentDefinitions {
  return reportDocument(buildSheet(makeReport(over), { inUAH }))
}

const text = (doc: TDocumentDefinitions) => JSON.stringify(doc.content)

/** The tasks table, wherever it is in the content. */
function table(doc: TDocumentDefinitions): ContentTable['table'] {
  const found = (doc.content as unknown[]).find((c) => typeof c === 'object' && c !== null && 'table' in c && 'layout' in c && (c as ContentTable).table.headerRows === 1)
  return (found as ContentTable).table
}

describe('reportDocument', () => {
  it('frames “Draft” beside the eyebrow only on a draft', () => {
    expect(text(documentOf())).toContain('"DRAFT"')
    expect(text(documentOf({ status: 'sent' }))).not.toContain('"DRAFT"')
  })

  it('sets the summary as a paragraph or as bullets, and leaves it out when empty', () => {
    expect(text(documentOf({ summary: 'All done.' }))).toContain('"text":"All done."')
    expect(text(documentOf({ summary: '- One\n- Two' }))).toContain('"ul":[{"text":"One"')
    expect(text(documentOf())).not.toContain('Summary')
  })

  it('says no tasks were done when there are none, with no table or total', () => {
    const doc = documentOf({ total_cents: 0 })
    expect(text(doc)).toContain('No tasks were completed in this period.')
    expect(text(doc)).not.toContain('TOTAL')
  })

  it('has a column for each kind of detail the tasks carry', () => {
    const plain = table(documentOf({ items: [makeReportItem()] }))
    // a number, the task, and nothing else
    expect(plain.widths).toHaveLength(3)

    const full = table(
      documentOf({
        total_cents: 5000,
        items: [makeReportItem({ project_name: 'Landing', seconds: 3600, price_cents: 5000 }), makeReportItem({ id: 'i-2', project_name: '' })],
      }),
    )
    // with the project, the time and the price
    expect(full.widths).toHaveLength(6)
    expect(JSON.stringify(full.body[2])).toContain('"—"')
  })

  it('puts the total under the prices, with hryvnias when asked', () => {
    const report = {
      total_cents: 10000,
      in_uah: { rate: '41.5', rate_on: '2030-02-01', total_cents: 415000 },
      items: [makeReportItem({ price_cents: 10000, price_in_uah_cents: 415000 })],
    }
    expect(text(documentOf(report))).toContain('TOTAL')
    expect(text(documentOf(report, true))).toContain('(~ ₴4,150.00)')
  })

  it('lets rows break across pages only when one could be taller than a page', () => {
    expect(table(documentOf({ items: [makeReportItem()] })).dontBreakRows).toBe(true)
    const long = makeReportItem({ notes: 'A long paragraph of notes. '.repeat(400) })
    expect(table(documentOf({ kind: 'detailed', items: [long] })).dontBreakRows).toBe(false)
  })

  it('carries a task’s notes under its title in a detailed report', () => {
    const doc = documentOf({ kind: 'detailed', items: [makeReportItem({ notes: 'Hero\nFooter' }), makeReportItem({ id: 'i-2', notes: 'Copy' })] })
    expect(text(doc)).toContain('"ul":[{"text":"Hero"')
    expect(text(doc)).toContain('"text":"Copy"')
  })

  it('signs every page, and never ends one with a heading', () => {
    const doc = documentOf()
    const footer = (doc.footer as (page: number, pages: number) => { columns: unknown[] })(1, 1)
    expect(JSON.stringify(footer.columns)).toContain('olena@example.test')
    const breakBefore = doc.pageBreakBefore as (node: { headlineLevel?: number; startPosition: { top: number } }) => boolean
    expect(breakBefore({ headlineLevel: 1, startPosition: { top: 800 } })).toBe(true)
    expect(breakBefore({ headlineLevel: 1, startPosition: { top: 100 } })).toBe(false)
    expect(breakBefore({ startPosition: { top: 800 } })).toBe(false)
  })
})
