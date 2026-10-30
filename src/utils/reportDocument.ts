import type { Content, ContentCanvas, ContentTable, CustomTableLayout, TableCell, TDocumentDefinitions } from 'pdfmake/interfaces'
import type { ReportSheet, SheetItem, TextBlock } from './reportSheet'

// A4 in points, with margins of 16mm at the sides and 14mm at the top and bottom.
const PAGE_WIDTH = 595.28
const PAGE_HEIGHT = 841.89
const MARGIN_X = 45.35
const MARGIN_Y = 39.69
const CONTENT_WIDTH = PAGE_WIDTH - 2 * MARGIN_X

/** The letterhead's logo box, its rule under it, and the room before the page's content. */
const LOGO_BOX: [number, number] = [150, 30]
const LETTERHEAD_RULE_GAP = 14
const LETTERHEAD_GAP = 22
/** Every page starts under the letterhead. */
const MARGIN_TOP = MARGIN_Y + LOGO_BOX[1] + LETTERHEAD_RULE_GAP + 1.5 + LETTERHEAD_GAP

/** Room a heading needs below it for itself and the first lines of its section. */
const HEADING_KEEP = 90

const INK = '#171717'
const INK_2 = '#404040'
const INK_3 = '#737373'
const DOT = '#a3a3a3'
const RULE = '#e5e5e5'
const ROW_RULE = '#f0f0f0'

/**
 * pdfmake's lineHeight multiplies Inter's own line (1.21 em), so a CSS-like
 * line height in ems is divided by it.
 */
const lead = (ems: number) => ems / 1.21

/** Letter spacing in ems, as pdfmake's characterSpacing in points. */
const tracking = (ems: number, size: number) => ems * size

/** Inter's height above the baseline, in ems. */
const ASCENT = 0.969

const CELL_PAD = 12

function rule(width: number, color: string, marginTop = 0): ContentCanvas {
  return {
    canvas: [{ type: 'line', x1: 0, y1: width / 2, x2: CONTENT_WIDTH, y2: width / 2, lineWidth: width, lineColor: color }],
    margin: [0, marginTop, 0, 0],
  }
}

/** "WORK REPORT", at the right. */
function eyebrow(s: ReportSheet): Content {
  return { text: s.labels.eyebrow.toUpperCase(), bold: true, fontSize: 8.5, color: INK_3, characterSpacing: tracking(0.14, 8.5), alignment: 'right' }
}

/**
 * The head of every page, as on a letterhead: the freelancer's logo (or
 * name) at the left; what the paper is and who it's for at the right; and
 * the accent's rule under both. Its dates are in the footer.
 */
function letterhead(s: ReportSheet): Content {
  const mark: Content = s.logo
    ? { image: s.logo, fit: LOGO_BOX }
    : { text: s.brand, bold: true, fontSize: 13, color: INK, characterSpacing: tracking(-0.01, 13) }
  const forWhom: Content[] = s.client
    ? [{ text: [`${s.client.label}: `, { text: s.client.name, color: INK }], fontSize: 9, color: INK_3, alignment: 'right', margin: [0, 4, 0, 0] }]
    : []
  return {
    stack: [
      { columns: [{ width: '*', stack: [mark] }, { width: '*', stack: [eyebrow(s), ...forWhom] }], columnGap: 16 },
      // under the logo's box, so it sits as low under a short logo or none
      { ...rule(1.5, s.accent), absolutePosition: { x: MARGIN_X, y: MARGIN_Y + LOGO_BOX[1] + LETTERHEAD_RULE_GAP } },
    ],
    margin: [MARGIN_X, MARGIN_Y, MARGIN_X, 0],
  }
}

/** The period, projects and count, set apart by light dots. */
function facts(s: ReportSheet): Content {
  const text = s.facts.flatMap((f, i) => (i === 0 ? [f] : [{ text: '  ·  ', color: DOT }, f]))
  return { text, fontSize: 9, color: INK_3, alignment: 'center', margin: [0, 5, 0, 0] }
}

/** A section's heading over a thin rule; headlineLevel keeps it with what follows. */
function heading(title: string): Content {
  return {
    stack: [
      { text: title.toUpperCase(), bold: true, fontSize: 9, color: INK, characterSpacing: tracking(0.08, 9), headlineLevel: 1 },
      rule(0.75, RULE, 3),
    ],
    margin: [0, 14, 0, 6],
  }
}

/**
 * Paragraphs and lists, as they were written, gap apart; a line that ends in
 * a colon over a list reads as the list's heading.
 */
function textBlocks(blocks: TextBlock[], gap: number, itemGap: number): Content[] {
  return blocks.map((b, i) => {
    const margin: [number, number, number, number] = [0, i ? gap : 0, 0, 0]
    if ('text' in b) {
      const intro = b.text.endsWith(':') && !!blocks[i + 1] && 'items' in blocks[i + 1]
      return intro ? { text: b.text, font: 'InterMedium', color: INK, margin } : { text: b.text, margin }
    }
    const items = b.items.map((text, j) => ({ text, margin: [0, j ? itemGap : 0, 0, 0] as [number, number, number, number] }))
    return b.ordered ? { ol: items, markerColor: INK_3, margin } : { ul: items, markerColor: INK_3, margin }
  })
}

function summary(s: ReportSheet): Content[] {
  if (s.summary.length === 0) return []
  return [heading(s.labels.summary), { stack: textBlocks(s.summary, 6, 1.5), margin: [0, 3, 0, 0] }]
}

function taskCell(it: SheetItem): TableCell {
  const stack: Content[] = [{ text: it.title, font: 'InterMedium', color: INK }]
  const notes = { fontSize: 9, color: INK_2, margin: [0, 2, 0, 0] as [number, number, number, number] }
  if (it.parentTitle) stack.unshift({ text: it.parentTitle, fontSize: 8, color: INK_3, margin: [0, 0, 0, 1] })
  if (it.notes.length) stack.push({ stack: textBlocks(it.notes, 3, 1), ...notes })
  return { stack }
}

function tasksTable(s: ReportSheet): ContentTable {
  const th = (text: string, alignment: 'left' | 'right' = 'left'): TableCell => ({
    text: text.toUpperCase(),
    font: 'InterSemiBold',
    fontSize: 8,
    color: INK_3,
    characterSpacing: tracking(0.04, 8),
    alignment,
  })
  const header: TableCell[] = [th('#'), th(s.labels.task)]
  const widths: (number | string)[] = [22, '*']
  if (s.showProject) {
    header.push(th(s.labels.project))
    widths.push(0.3 * CONTENT_WIDTH - CELL_PAD)
  }
  header.push(th(s.labels.completed, 'right'))
  widths.push(72)
  if (s.showTime) {
    header.push(th(s.labels.time, 'right'))
    widths.push(60 - CELL_PAD)
  }
  if (s.showPrice) {
    header.push(th(s.labels.price, 'right'))
    // Hryvnias under the prices take a little more room.
    widths.push((s.items.some((it) => it.priceInUAH) ? 100 : 84) - CELL_PAD)
  }

  const rows = s.items.map((it, i) => {
    const row: TableCell[] = [{ text: `${i + 1}.`, color: INK_3 }, taskCell(it)]
    if (s.showProject) row.push({ text: it.projectName || '—', color: INK_2 })
    row.push({ text: it.completed, color: INK_2, alignment: 'right', noWrap: true })
    if (s.showTime) row.push({ text: it.time || '—', color: it.time ? INK_2 : INK_3, alignment: 'right', noWrap: true })
    if (s.showPrice) {
      const price: TableCell = { text: it.price, font: 'InterMedium', color: INK, alignment: 'right', noWrap: true }
      const inUAH: TableCell = { text: it.priceInUAH, fontSize: 8, color: INK_3, alignment: 'right', noWrap: true, margin: [0, 1, 0, 0] }
      row.push(!it.price ? { text: '—', color: INK_3, alignment: 'right' } : it.priceInUAH ? { stack: [price, inUAH] } : price)
    }
    return row
  })

  // Padding sits inside a column's share: after the task and project, before the time and the price.
  const padRight = new Set(s.showProject ? [1, 2] : [1])
  const priceColumn = s.showPrice ? widths.length - 1 : -1
  const timeColumn = s.showTime ? widths.length - (s.showPrice ? 2 : 1) : -1
  const layout: CustomTableLayout = {
    hLineWidth: (i, node) => (i === 0 ? 0 : i === 1 ? 0.75 : i <= node.table.body.length ? 0.5 : 0),
    hLineColor: (i) => (i === 1 ? RULE : ROW_RULE),
    vLineWidth: () => 0,
    paddingLeft: (i) => (i === priceColumn || i === timeColumn ? CELL_PAD : 0),
    paddingRight: (i) => (padRight.has(i) ? CELL_PAD : 0),
    paddingTop: (i) => (i === 0 ? 0 : 5),
    paddingBottom: (i) => (i === 0 ? 4 : 5),
  }
  const taskWidth = CONTENT_WIDTH - widths.reduce<number>((sum, w) => sum + (typeof w === 'number' ? w : 0), 0) - CELL_PAD * (s.showTime ? 3 : 2)
  return { table: { headerRows: 1, dontBreakRows: rowsFitPage(s.items, taskWidth), widths, body: [header, ...rows] }, layout }
}

/**
 * Whether every row surely fits on a page, judged generously by its notes'
 * length. pdfmake drops a row taller than a page when rows mustn't break, so
 * rows only stay whole when none can be.
 */
function rowsFitPage(items: SheetItem[], taskWidth: number): boolean {
  const perLine = taskWidth / (9 * 0.5)
  const lines = (text: string) => Math.ceil(text.length / perLine) || 1
  return items.every((it) => {
    const notes = it.notes.flatMap((b) => ('text' in b ? [b.text] : b.items))
    const height = lines(it.title) * 15 + (it.parentTitle ? 11 : 0) + notes.reduce((sum, n) => sum + lines(n) * 13, 0)
    return height < 500
  })
}

/** The sum under the price column, its label on the same baseline; under it, the sum in hryvnias. */
function total(s: ReportSheet): Content {
  return {
    unbreakable: true,
    stack: [
      rule(1, s.accent),
      {
        columns: [
          { width: '*', text: '' },
          {
            width: 'auto',
            text: s.labels.total.toUpperCase(),
            bold: true,
            fontSize: 8,
            color: INK_3,
            characterSpacing: tracking(0.08, 8),
            margin: [0, ASCENT * (12 - 8), 0, 0],
          },
          {
            width: 'auto',
            // The hryvnias go under the total, as under the prices, so turning them on doesn't move it.
            stack: [
              { text: s.total, bold: true, fontSize: 12, color: INK },
              ...(s.totalInUAH ? [{ text: s.totalInUAH, fontSize: 9, color: INK_3, margin: [0, 1, 0, 0] as [number, number, number, number] }] : []),
            ],
            alignment: 'right',
          },
        ],
        columnGap: 16,
        margin: [0, 6, 0, 0],
      },
    ],
  }
}

function tasks(s: ReportSheet): Content[] {
  if (s.items.length === 0) {
    return [heading(s.labels.tasks), { text: s.labels.noTasks, fontSize: 9.5, color: INK_3, margin: [0, 4, 0, 0] }]
  }
  return [heading(s.labels.tasks), tasksTable(s), ...(s.showPrice ? [total(s)] : [])]
}

/** The freelancer's business details, a line each as written, kept on one page. */
function details(s: ReportSheet): Content[] {
  if (s.details.length === 0) return []
  return [
    {
      unbreakable: true,
      stack: [heading(s.labels.details), { stack: s.details.map((text) => ({ text })), fontSize: 9.5, margin: [0, 3, 0, 0] }],
    },
  ]
}

/** The report as a pdfmake document: A4, set in Inter. */
export function reportDocument(s: ReportSheet): TDocumentDefinitions {
  return {
    pageSize: 'A4',
    pageMargins: [MARGIN_X, MARGIN_TOP, MARGIN_X, MARGIN_Y],
    info: { title: s.title, author: s.footerRight, creator: 'Helpic' },
    defaultStyle: { font: 'Inter', fontSize: 10, lineHeight: lead(1.45), color: INK_2 },
    header: () => letterhead(s),
    footer: () => ({
      columns: [s.footerLeft, { text: s.footerRight, alignment: 'right' }],
      columnGap: 12,
      fontSize: 8.5,
      color: INK_3,
      margin: [MARGIN_X, 0, MARGIN_X, 0],
    }),
    // A heading never ends a page.
    pageBreakBefore: (node) =>
      node.headlineLevel === 1 && node.startPosition.top > PAGE_HEIGHT - MARGIN_Y - HEADING_KEEP,
    content: [
      { text: s.title, bold: true, fontSize: 20, color: INK, alignment: 'center', characterSpacing: tracking(-0.02, 20), lineHeight: lead(1.2) },
      facts(s),
      ...summary(s),
      ...tasks(s),
      ...details(s),
    ],
  }
}
