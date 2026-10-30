import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import ReportView from '@/views/ReportView.vue'
import { t } from '@/i18n'
import { useToasts } from '@/composables/useToasts'
import type { Report } from '@/types/reports'
import { api, render, status, type Reply } from '../../helpers'
import { $$, button, click, field, type } from '../../dom'
import { makeReport, makeReportItem, makeUser } from '../../fixtures'

const pdf = vi.hoisted(() => ({ render: vi.fn(), save: vi.fn() }))
vi.mock('@/utils/reportPdf', () => ({
  renderReportPdf: pdf.render,
  savePdf: pdf.save,
  pdfFileName: (title: string) => `${title}.pdf`,
}))

const me = makeUser()

beforeEach(() => {
  pdf.render.mockReset().mockResolvedValue(new ArrayBuffer(8))
  pdf.save.mockReset()
})

/** The report page's API: the report, its history, and the report as changed by each call. */
function serve(report: Report = makeReport(), extra: Record<string, Reply> = {}) {
  const changed = (over: Partial<Report>) => ({ report: { ...report, ...over } })
  return api({
    [`GET /reports/${report.id}`]: { report },
    [`GET /reports/${report.id}/history`]: { events: [] },
    [`PUT /reports/${report.id}`]: (c: { body: Partial<Report> }) => changed(c.body),
    [`POST /reports/${report.id}/send`]: changed({ status: 'sent', sent_at: '2030-02-02T00:00:00Z', can_edit: false }),
    [`POST /reports/${report.id}/paid`]: changed({ status: 'paid', paid_at: '2030-02-03T00:00:00Z', can_mark_paid: false }),
    ...extra,
  })
}

function open(report?: Report, extra?: Record<string, Reply>) {
  const server = serve(report, extra)
  return { server, page: render(ReportView, { path: `/reports/${report?.id ?? 'r-1'}`, user: me, global: { stubs: { PdfPreview: { template: '<div class="pdf" />' } } } }) }
}

const confirmIn = (label: string) => $$('[role="dialog"] button').find((b) => b.textContent?.trim() === label)!

describe('ReportView', () => {
  it('prints the preview and states what the report is', async () => {
    const { page } = open(makeReport({ items: [makeReportItem()], total_cents: 5000, projects: [{ id: 'p', name: 'Landing' }] }))
    const view = await page
    expect(pdf.render).toHaveBeenCalledWith(expect.objectContaining({ id: 'r-1' }), { inUAH: false })
    expect(view.find('.pdf').exists()).toBe(true)
    expect(view.text()).toContain('Acme')
    expect(view.text()).toContain('Landing')
    expect(view.text()).toContain('$50.00')
    expect(view.text()).toContain(t('report.statusDraft'))
  })

  it('says a report that isn’t there can’t be found, or that it couldn’t load', async () => {
    api({ 'GET /reports/r-1': status(404) })
    const view = await render(ReportView, { path: '/reports/r-1', user: me })
    expect(view.text()).toContain(t('report.notFound'))

    document.body.innerHTML = ''
    api({ 'GET /reports/r-1': status(500) })
    await render(ReportView, { path: '/reports/r-1', user: me })
    expect(useToasts().toasts.at(-1)?.message).toBe(t('report.loadFailed'))
  })

  it('saves the title and summary of a draft, and resets unsaved edits', async () => {
    const { server, page } = open()
    await page
    await type(field(t('report.title')), 'February')
    await click(button(t('common.reset')))
    expect(field(t('report.title')).value).toBe('January')
    await type(field(t('report.title')), 'February')
    await type(field<HTMLTextAreaElement>(t('report.summary')), 'All done')
    await click(button(t('common.save')))
    expect(server.to('PUT /reports/r-1')[0].body).toEqual({ title: 'February', summary: 'All done' })
    expect(pdf.render).toHaveBeenCalledTimes(2)
  })

  it('switches the type at once, keeping the saved title', async () => {
    const { server, page } = open()
    const view = await page
    const detailed = view.findAll('input[type="radio"]')[1]
    await detailed.setValue(true)
    await flushPromises()
    expect(server.to('PUT /reports/r-1')[0].body).toEqual({ title: 'January', summary: '', kind: 'detailed' })
  })

  it('edits a detailed report’s task notes, folded until opened, and removes a task', async () => {
    const report = makeReport({ kind: 'detailed', items: [makeReportItem({ id: 'i1', title: 'Hero', notes: 'First\nSecond' }), makeReportItem({ id: 'i2', title: 'Footer' })] })
    const { server, page } = open(report, {
      'PUT /reports/r-1/items/i1': { report: { ...report, items: [{ ...report.items![0], notes: 'Changed' }, report.items![1]] } },
      'DELETE /reports/r-1/items/i2': { report: { ...report, items: [report.items![0]] } },
    })
    const view = await page
    expect(view.text()).toContain('First')
    expect(view.text()).not.toContain('Second')
    await click(byExpanded(0))
    const notes = document.getElementById('notes-i1') as HTMLTextAreaElement
    expect(document.activeElement).toBe(notes)
    notes.value = 'First\nSecond'
    notes.dispatchEvent(new Event('change'))
    expect(server.to('PUT /reports/r-1/items/i1')).toHaveLength(0)
    notes.value = 'Changed'
    notes.dispatchEvent(new Event('change'))
    await flushPromises()
    expect(server.to('PUT /reports/r-1/items/i1')[0].body).toEqual({ notes: 'Changed' })
    await click(byExpanded(0))
    expect(document.getElementById('notes-i1')).toBeNull()

    await click(button(t('report.removeTask', { title: 'Footer' })))
    expect(server.to('DELETE /reports/r-1/items/i2')).toHaveLength(1)
    expect(view.text()).not.toContain('Footer')
  })

  it('sends a draft to its client after asking', async () => {
    const { server, page } = open(makeReport({ items: [makeReportItem()] }))
    const view = await page
    await click(button(t('report.sendTo', { name: 'Acme' })))
    await click(confirmIn(t('report.send')))
    expect(server.to('POST /reports/r-1/send')).toHaveLength(1)
    expect(useToasts().toasts.at(-1)?.message).toBe(t('report.sentTo', { name: 'Acme' }))
    expect(view.text()).toContain(t('report.statusSent', { date: '2 Feb 2030' }))
  })

  it('won’t send a draft with nothing in it', async () => {
    const { page } = open()
    await page
    expect(button(t('report.sendTo', { name: 'Acme' })).disabled).toBe(true)
  })

  it('lets the client mark a sent report paid', async () => {
    const report = makeReport({ status: 'sent', can_edit: false, can_delete: false, can_mark_paid: true, sent_at: '2030-02-02T00:00:00Z' })
    const { server, page } = open(report)
    const view = await page
    expect(view.text()).toContain(t('report.basic'))
    await click(button(t('report.markPaid')))
    await click(confirmIn(t('report.markPaid')))
    expect(server.to('POST /reports/r-1/paid')).toHaveLength(1)
    expect(view.text()).toContain(t('report.statusPaid', { date: '3 Feb 2030' }))
  })

  it('lets the freelancer mark a sent report paid, telling the client', async () => {
    const report = makeReport({ status: 'sent', can_edit: false, can_delete: false, can_mark_paid: true, sent_at: '2030-02-02T00:00:00Z' })
    const { server, page } = open(report)
    const view = await page
    await click(button(t('report.markPaid')))
    expect(document.body.textContent).toContain(t('report.confirmPaidText', { name: 'Acme' }))
    await click(confirmIn(t('report.markPaid')))
    expect(server.to('POST /reports/r-1/paid')).toHaveLength(1)
    expect(view.text()).toContain(t('report.statusPaid', { date: '3 Feb 2030' }))
  })

  it('downloads the PDF, with hryvnias when they’re switched on', async () => {
    const report = makeReport({ total_cents: 10000, in_uah: { rate: '41.5', rate_on: '2030-02-01', total_cents: 415000 } })
    const { page } = open(report)
    const view = await page
    expect(view.text()).toContain('₴4,150.00')
    await click(`[role="switch"]`)
    expect(localStorage.getItem('helpic:report-in-uah')).toBe('1')
    expect(pdf.render).toHaveBeenLastCalledWith(expect.anything(), { inUAH: true })

    await click(button(t('report.options')))
    await click(button(t('report.downloadPdf')))
    expect(pdf.save).toHaveBeenCalledWith(expect.any(ArrayBuffer), 'January.pdf')
  })

  it('deletes a report after saying what that does, and goes back to the list', async () => {
    const { server, page } = open(makeReport({ status: 'sent', can_edit: false }))
    const view = await page
    await click(button(t('report.options')))
    await click(button(t('report.deleteReport')))
    expect(document.body.textContent).toContain(t('report.deleteSentText', { name: 'Acme' }))
    await click(confirmIn(t('common.delete')))
    expect(server.to('DELETE /reports/r-1')).toHaveLength(1)
    await vi.waitFor(() => expect(view.router.currentRoute.value.path).toBe('/reports'))
  })

  it('says what went wrong with the preview, a send or a download', async () => {
    pdf.render.mockRejectedValue(new Error('font'))
    const { page } = open(makeReport({ items: [makeReportItem()], client: null }), { 'POST /reports/r-1/send': status(500) })
    const view = await page
    expect(useToasts().toasts.at(-1)?.message).toBe(t('report.renderFailed'))
    expect(view.text()).toContain(t('report.statusPersonal'))
    await click(button(t('report.options')))
    await click(button(t('report.downloadPdf')))
    expect(useToasts().toasts.at(-1)?.message).toBe(t('report.downloadFailed'))
  })
})

function byExpanded(i: number): HTMLElement {
  return $$('button[aria-expanded]').filter((b) => b.getAttribute('aria-controls')?.startsWith('notes-'))[i]
}

describe('ReportView › discussion', () => {
  const sent = (over: Partial<Report> = {}) =>
    makeReport({
      status: 'sent',
      sent_at: '2030-02-02T00:00:00Z',
      can_edit: false,
      can_delete: false,
      can_comment: true,
      items: [makeReportItem({ title: 'Logo', price_cents: 50000 }), makeReportItem({ id: 'i-2', title: 'Landing' })],
      ...over,
    })
  const comment = (over = {}) => ({
    id: 'c-1',
    item_id: 'i-1',
    item_title: 'Logo',
    author: { id: 'u-client', name: 'Acme', email: 'acme@example.test' },
    body: 'Why 500?',
    created_at: '2030-02-02T10:00:00Z',
    ...over,
  })
  const asClient = makeUser({ id: 'u-client', email: 'acme@example.test', role: 'client' })
  const stubs = { PdfPreview: { template: '<div class="pdf" />' } }

  it('isn’t there on a draft the client never had', async () => {
    const { page } = open(makeReport({ items: [makeReportItem()] }))
    const view = await page
    expect(view.text()).not.toContain(t('reportDiscussion.title'))
  })

  it('lets the client ask about a line, and resolve it', async () => {
    const report = sent()
    const asked = { ...report, open_questions: 1, comment_count: 1, items: [{ ...report.items![0], question_open: true, comment_count: 1 }, report.items![1]] }
    const server = serve(report, {
      'GET /reports/r-1/comments': { comments: [] },
      'POST /reports/r-1/comments': { comment: comment() },
      'POST /reports/r-1/items/i-1/resolve': { report: { ...asked, open_questions: 0, items: report.items } },
    })
    const view = await render(ReportView, { path: '/reports/r-1', user: asClient, global: { stubs } })
    expect(view.text()).toContain(t('reportDiscussion.hintClient'))

    await click(view.findAll('button[aria-expanded]').find((b) => b.text().includes('Logo'))!.element)
    server.reply('GET /reports/r-1', { report: asked })
    server.reply('GET /reports/r-1/comments', { comments: [comment()] })
    await type(field<HTMLTextAreaElement>(t('reportDiscussion.aboutLine', { title: 'Logo' })), 'Why 500?')
    await click(button(t('reportDiscussion.ask')))
    expect(server.to('POST /reports/r-1/comments')[0].body).toEqual({ item_id: 'i-1', body: 'Why 500?' })
    await flushPromises()
    expect(view.text()).toContain('Why 500?')
    expect(view.text()).toContain(t('reportDiscussion.openQuestions', { n: 1 }, 1))

    await click(button(t('reportDiscussion.resolve')))
    expect(server.to('POST /reports/r-1/items/i-1/resolve')).toHaveLength(1)
    expect(view.text()).not.toContain(t('reportDiscussion.openQuestions', { n: 1 }, 1))
  })

  it('warns before a payment with questions open', async () => {
    serve(sent({ can_mark_paid: true, open_questions: 2 }), { 'GET /reports/r-1/comments': { comments: [] } })
    await render(ReportView, { path: '/reports/r-1', user: asClient, global: { stubs } })
    await click(button(t('report.markPaid')))
    expect(document.body.textContent).toContain(t('report.paidWithQuestions', { n: 2 }, 2))
  })

  it('keeps what was said about a dropped line, and closes the discussion once paid', async () => {
    serve(sent({ status: 'paid', can_comment: false, comment_count: 2 }), {
      'GET /reports/r-1/comments': { comments: [comment({ item_id: null, item_title: 'Logo' }), comment({ id: 'c-2', item_id: null, item_title: '', body: 'Thanks' })] },
    })
    const view = await render(ReportView, { path: '/reports/r-1', user: asClient, global: { stubs } })
    expect(view.text()).toContain(t('reportDiscussion.closed'))
    expect(view.text()).toContain(t('reportDiscussion.dropped'))
    expect($$('textarea')).toHaveLength(0)
  })

  it('lets the client approve the report, or ask for changes saying what', async () => {
    const report = sent({ can_review: true })
    const server = serve(report, {
      'GET /reports/r-1/comments': { comments: [] },
      'PUT /reports/r-1/review': (c: { body: { review: string } }) => ({ report: { ...report, review: c.body.review, reviewed_at: '2030-02-03T00:00:00Z' } }),
    })
    const view = await render(ReportView, { path: '/reports/r-1', user: asClient, global: { stubs } })

    await click(button(t('reportReview.approve')))
    expect(server.to('PUT /reports/r-1/review')[0].body).toEqual({ review: 'approved', comment: '' })
    expect(view.text()).toContain(t('reportReview.approved'))

    // asking for changes needs a word on what
    await click(button(t('reportReview.requestChanges')))
    await click(confirmIn(t('reportReview.send')))
    expect(document.body.textContent).toContain(t('reportReview.changesRequired'))
    expect(server.to('PUT /reports/r-1/review')).toHaveLength(1)
    await type(field<HTMLTextAreaElement>(t('reportReview.changesLabel')), 'Two banners, not three')
    await click(confirmIn(t('reportReview.send')))
    expect(server.to('PUT /reports/r-1/review')[1].body).toEqual({ review: 'changes_requested', comment: 'Two banners, not three' })
    expect(view.text()).toContain(t('reportReview.changesRequested'))
    expect($$('[role="dialog"]')).toHaveLength(0)
  })

  it('shows the freelancer the changes asked for, to correct the report or keep it as it is', async () => {
    const report = sent({ can_recall: true, can_answer: true, review: 'changes_requested', reviewed_at: '2030-02-03T00:00:00Z', review_note: 'Two banners, not three' })
    const { server, page } = open(report, {
      'GET /reports/r-1/comments': { comments: [] },
      'POST /reports/r-1/keep': (c: { body: { comment: string } }) => ({ report: { ...report, review: null, reviewed_at: null, review_note: '', review_answer: c.body.comment, can_answer: false } }),
    })
    const view = await page
    expect(view.text()).toContain(t('report.changesAsked', { name: 'Acme' }))
    expect(view.text()).toContain('Two banners, not three')
    expect(view.text()).not.toContain(t('reportReview.approve'))
    // taking it back is one of the two answers, not a button of its own
    expect(view.text()).not.toContain(t('report.recall'))

    await click(button(t('report.correct')))
    expect(document.body.textContent).toContain(t('report.confirmRecall'))
    await click(confirmIn(t('common.cancel')))

    await click(button(t('report.keep')))
    await click(confirmIn(t('report.keep')))
    expect(document.body.textContent).toContain(t('report.keepRequired'))
    await type(field<HTMLTextAreaElement>(t('report.keepLabel')), 'Three were in the brief')
    await click(confirmIn(t('report.keep')))
    expect(server.to('POST /reports/r-1/keep')[0].body).toEqual({ comment: 'Three were in the brief' })
    expect(view.text()).not.toContain(t('report.changesAsked', { name: 'Acme' }))
    expect(view.text()).toContain(t('report.recall'))
  })

  it('shows the client why the report was kept as it is, to review it again', async () => {
    serve(sent({ can_review: true, review_answer: 'Three were in the brief' }), { 'GET /reports/r-1/comments': { comments: [] } })
    const view = await render(ReportView, { path: '/reports/r-1', user: asClient, global: { stubs } })
    expect(view.text()).toContain(t('reportReview.answered', { name: 'Olena Freelancer' }))
    expect(view.text()).toContain('Three were in the brief')
    expect(view.text()).toContain(t('reportReview.approve'))
  })

  it('lets the freelancer take a sent report back, and says so on the draft', async () => {
    const report = sent({ can_recall: true })
    const { server, page } = open(report, {
      'GET /reports/r-1/comments': { comments: [] },
      'POST /reports/r-1/recall': { report: { ...report, status: 'draft', sent_at: null, recalled_at: '2030-02-03T00:00:00Z', can_edit: true, can_recall: false } },
    })
    const view = await page
    await click(button(t('report.recall')))
    await click(confirmIn(t('report.recall')))
    expect(server.to('POST /reports/r-1/recall')).toHaveLength(1)
    expect(view.text()).toContain(t('report.recalledNote', { name: 'Acme' }))
    // still discussed, and now editable
    expect(view.text()).toContain(t('reportDiscussion.title'))
    expect(field(t('report.title')).value).toBe('January')
  })
})
