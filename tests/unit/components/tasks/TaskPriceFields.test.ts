import { describe, expect, it } from 'vitest'
import TaskPriceFields from '@/components/tasks/TaskPriceFields.vue'
import EstimateChip from '@/components/tasks/EstimateChip.vue'
import { useToasts } from '@/composables/useToasts'
import { t } from '@/i18n'
import type { Task } from '@/types/tasks'
import { api, render, status } from '../../../helpers'
import { $, button, click, field, press } from '../../../dom'
import { makeEstimate, makeTask, makeUser } from '../../../fixtures'
import { mount } from '@vue/test-utils'

const freelancer = makeUser()
const client = makeUser({ id: 'u-client', name: 'Acme', email: 'acme@example.test', role: 'client' })

function show(task: Task, user = freelancer) {
  return render(TaskPriceFields, { props: { task }, user })
}

describe('TaskPriceFields', () => {
  it('shows nothing to whoever has nothing to see', async () => {
    const block = await show(makeTask({ can_set_price: false, can_see_price: false, can_track_time: false }), client)
    expect(block.find('section').exists()).toBe(false)
  })

  it('shows a team member only the estimated time', async () => {
    const block = await show(makeTask({ can_set_price: false, can_see_price: false, can_track_time: false, estimate_seconds: 28800 }), client)
    expect(block.text()).toContain('8h')
    expect(block.text()).not.toContain(t('timelog.billing'))
    expect(block.text()).not.toContain(t('estimate.state'))
  })

  it('tells the client how the task is billed and what it costs', async () => {
    const block = await show(makeTask({ can_set_price: false, can_track_time: false, price_cents: 50000 }), client)
    expect(block.text()).toContain(t('timelog.fixed'))
    expect(block.text()).toContain('$500.00')
    expect(block.find('[role="group"]').exists()).toBe(false)
  })

  it('lets the freelancer estimate the time, read as the time log reads it', async () => {
    const saved = makeTask({ can_estimate: true, estimate_seconds: 5400 })
    const server = api({ 'PUT /tasks/t-1/estimate-time': { task: saved } })
    const block = await show(makeTask({ can_estimate: true }))
    await click(button(t('estimate.clickToSet')))
    const input = field(t('estimate.title'))
    input.value = 'soon'
    input.dispatchEvent(new Event('input'))
    await press('Enter', input)
    expect(server.to('PUT /tasks/t-1/estimate-time')).toHaveLength(0)
    expect(useToasts().toasts.at(-1)?.message).toBe(t('estimate.timeInvalid'))

    input.value = '1h 30m'
    input.dispatchEvent(new Event('input'))
    await press('Enter', input)
    await new Promise((r) => setTimeout(r))
    expect(server.to('PUT /tasks/t-1/estimate-time')[0].body).toEqual({ seconds: 5400 })
    expect(block.emitted('changed')?.[0]).toEqual([saved])
  })

  it('by the hour, shows the rate and what the estimate and the time spent come to', async () => {
    const block = await show(makeTask({ billing: 'hourly', estimate_seconds: 28800, tracked_seconds: 5400, price_cents: 6000, hourly_rate_cents: 4000 }))
    expect(block.text()).toContain('$40/h')
    expect(block.text()).toContain('8h · ≈ $320.00')
    expect(block.text()).toContain('1h 30m · $60.00')
    expect(block.find(`[title="${t('task.clickToSetPrice')}"]`).exists()).toBe(false)
  })

  it('sends the estimate to the client, then takes it back', async () => {
    const sent = makeTask({ can_estimate: true, price_cents: 50000, estimate: makeEstimate(), can_withdraw_estimate: true })
    const server = api({ 'POST /tasks/t-1/estimate': { task: sent }, 'DELETE /tasks/t-1/estimate': { task: makeTask() } })
    const block = await show(makeTask({ can_estimate: true, price_cents: 50000, can_send_estimate: true }))
    expect(block.text()).toContain(t('estimate.notSent'))
    await click(button(t('estimate.send')))
    expect(server.to('POST /tasks/t-1/estimate')).toHaveLength(1)
    expect(useToasts().toasts.at(-1)?.message).toBe(t('estimate.sent'))

    await block.setProps({ task: sent })
    expect(block.text()).toContain(t('estimate.status.pending'))
    await click(button(t('estimate.withdraw')))
    expect(server.to('DELETE /tasks/t-1/estimate')).toHaveLength(1)
  })

  it('shows the freelancer what the client asked, and what was sent before a change', async () => {
    const estimate = makeEstimate({
      status: 'changes_requested',
      note: 'Too much for a logo',
      reviewed_at: '2030-01-12T09:00:00Z',
      reviewer: { id: client.id, name: client.name, email: client.email },
      outdated: true,
    })
    const block = await show(makeTask({ can_estimate: true, price_cents: 40000, estimate, can_send_estimate: true }))
    expect(block.text()).toContain('Too much for a logo')
    expect(block.text()).toContain(t('estimate.status.outdated'))
    expect(block.text()).toContain(t('estimate.sentWas', { value: '8h · $500.00' }))
    expect(button(t('estimate.sendAgain'))).toBeTruthy()
  })

  it('lets the client approve it, or ask for changes saying what', async () => {
    const task = makeTask({ can_set_price: false, estimate: makeEstimate(), can_review_estimate: true })
    const server = api({ 'PUT /tasks/t-1/estimate/review': (c: { body: { review: string } }) => ({
      task: { ...task, estimate: makeEstimate({ status: c.body.review as 'approved' }) },
    }) })
    const block = await show(task, client)
    expect(block.text()).toContain(t('estimate.youToApprove'))

    await click(button(t('estimate.askChanges')))
    await click(button(t('estimate.submitChanges')))
    expect(server.to('PUT /tasks/t-1/estimate/review')).toHaveLength(0)
    expect($('[role="dialog"]')?.textContent).toContain(t('estimate.changesRequired'))
    const note = field<HTMLTextAreaElement>(t('estimate.noteLabel'))
    note.value = 'Less time, please'
    note.dispatchEvent(new Event('input'))
    await click(button(t('estimate.submitChanges')))
    expect(server.to('PUT /tasks/t-1/estimate/review')[0].body).toEqual({ review: 'changes_requested', note: 'Less time, please' })
    expect($('[role="dialog"]')).toBeNull()

    await click(button(t('estimate.approve')))
    expect(server.to('PUT /tasks/t-1/estimate/review')[1].body).toEqual({ review: 'approved', note: '' })
    expect(useToasts().toasts.at(-1)?.message).toBe(t('estimate.approved'))
  })

  it('says when the server refuses', async () => {
    api({ 'POST /tasks/t-1/estimate': status(409, { error: { code: 'conflict', message: 'The estimate is already sent as it is' } }) })
    await show(makeTask({ can_estimate: true, price_cents: 100, can_send_estimate: true }))
    await click(button(t('estimate.send')))
    expect(useToasts().toasts.at(-1)?.message).toBe('The estimate is already sent as it is')
  })
})

describe('EstimateChip', () => {
  it('flags an estimate waiting on someone, and nothing else', () => {
    const chip = (estimate: Task['estimate']) => mount(EstimateChip, { props: { estimate } })
    expect(chip(makeEstimate()).attributes('aria-label')).toBe(t('estimate.cardPending'))
    expect(chip(makeEstimate({ status: 'changes_requested' })).attributes('aria-label')).toBe(t('estimate.cardChanges'))
    for (const e of [null, makeEstimate({ status: 'approved' }), makeEstimate({ outdated: true })]) {
      expect(chip(e).find('span').exists()).toBe(false)
    }
  })
})
