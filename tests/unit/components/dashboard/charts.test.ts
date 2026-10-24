import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import EarningsChart from '@/components/dashboard/EarningsChart.vue'
import WorkloadDonut from '@/components/dashboard/WorkloadDonut.vue'
import Sparkline from '@/components/dashboard/Sparkline.vue'
import ProgressRing from '@/components/dashboard/ProgressRing.vue'
import PeopleCard from '@/components/dashboard/PeopleCard.vue'
import { render } from '../../../helpers'

const months = (cents: number[]) =>
  cents.map((c, i) => ({ key: `2030-0${i + 1}`, label: `M${i + 1}`, name: `Month ${i + 1}`, cents: c, current: i === cents.length - 1 }))

describe('EarningsChart', () => {
  it('shows a month’s amount when it is hovered or focused', async () => {
    const chart = mount(EarningsChart, { props: { months: months([1000, 5000, 3000]), currency: 'USD', label: 'Paid' } })
    const hits = chart.findAll('[aria-label^="Month"]')
    expect(hits.map((h) => h.attributes('aria-label'))).toEqual(['Month 1: $10.00', 'Month 2: $50.00', 'Month 3: $30.00'])
    await hits[1].trigger('mouseenter')
    expect(chart.get('[role="tooltip"]').text()).toContain('$50.00')
    await hits[1].trigger('mouseleave')
    expect(chart.find('[role="tooltip"]').exists()).toBe(false)
    await hits[0].trigger('focus')
    expect(chart.get('[role="tooltip"]').text()).toContain('$10.00')
    await hits[0].trigger('blur')
  })

  it('lies flat with its empty text when nothing was paid, one month in the middle', () => {
    const empty = mount(EarningsChart, { props: { months: months([0, 0]), currency: 'USD', label: 'Paid', emptyText: 'No payments yet' } })
    expect(empty.text()).toContain('No payments yet')
    const one = mount(EarningsChart, { props: { months: months([100]), currency: 'USD', label: 'Paid' } })
    expect(one.html()).toContain('left: 50%')
  })
})

describe('WorkloadDonut', () => {
  const slices = [
    { key: 'new', label: 'New', count: 2, stroke: 'stroke-sky-500', dot: 'bg-sky-500' },
    { key: 'done', label: 'Done', count: 0, stroke: 'stroke-emerald-500', dot: 'bg-emerald-500' },
    { key: 'doing', label: 'Doing', count: 2, stroke: 'stroke-amber-500', dot: 'bg-amber-500' },
  ]

  it('draws an arc per status with tasks, lifting the one under the pointer', async () => {
    const donut = await render(WorkloadDonut, { props: { slices, value: '4', caption: 'open' } })
    expect(donut.findAll('circle.stroke-sky-500, circle.stroke-amber-500')).toHaveLength(2)
    expect(donut.find('circle.stroke-emerald-500').exists()).toBe(false)
    expect(donut.text()).toContain('4')
    await donut.findAll('a')[0].trigger('mouseenter')
    expect(donut.html()).toContain('stroke-width')
    await donut.findAll('a')[0].trigger('mouseleave')
  })

  it('is an empty track without tasks', async () => {
    const donut = await render(WorkloadDonut, { props: { slices: slices.map((s) => ({ ...s, count: 0 })), value: '0', caption: 'open' } })
    expect(donut.findAll('circle.stroke-sky-500')).toHaveLength(0)
  })
})

describe('Sparkline and ProgressRing', () => {
  it('draws a line through the values, flat and dashed when all are zero', () => {
    const line = mount(Sparkline, { props: { values: [1, 3, 2] } })
    expect(line.findAll('path')[1].attributes('d')).toMatch(/^M0,/)
    expect(line.find('span').exists()).toBe(true)
    expect(mount(Sparkline, { props: { values: [0, 0] } }).find('path').attributes('stroke-dasharray')).toBe('3 3')
    expect(mount(Sparkline, { props: { values: [5] } }).find('span').attributes('style')).toContain('left: 50%')
    expect(mount(Sparkline, { props: { values: [] } }).find('path').attributes('d')).toBe('')
  })

  it('fills to the percent, clamped, with a check when full', () => {
    expect(mount(ProgressRing, { props: { percent: 40 } }).text()).toContain('40')
    expect(mount(ProgressRing, { props: { percent: 100 } }).find('svg path').exists()).toBe(true)
    expect(mount(ProgressRing, { props: { percent: 150 } }).html()).toContain(`${(2 * Math.PI * 15).toFixed(0)}`)
  })
})

describe('PeopleCard', () => {
  const party = (id: string) => ({ id, name: id === 'c' ? '' : `Person ${id}`, email: `${id}@x` })

  it('ranks the first three with their share and trend, counting the rest', async () => {
    const people = [
      { party: party('a'), open: 2, overdue: 1, value: 9000, series: [0, 0, 0, 0, 4000, 5000] },
      { party: party('b'), open: 0, overdue: 0, value: 900, series: [0, 0, 0, 0, 0, 900] },
      { party: party('c'), open: 1, overdue: 0, value: 50, series: [0, 0, 0, 0, 100, 50] },
      { party: party('d'), open: 0, overdue: 0, value: 0, series: [0, 0, 0, 0, 0, 0] },
    ]
    const card = await render(PeopleCard, { props: { title: 'Clients', caption: 'By earned', to: '/clients', people, currency: 'USD', loaded: true, emptyText: 'None' } })
    expect(card.text()).toContain('$90')
    // the trend against the month before, or the share when there's nothing before
    expect(card.text()).toContain('↗ 25%')
    expect(card.text()).toContain('↘ 50%')
    expect(card.text()).toContain('9%')
    expect(card.text()).toContain('1 more')
  })

  it('ranks by open tasks with a bar, and offers to add someone when there’s nobody', async () => {
    const card = await render(PeopleCard, { props: { title: 'Clients', caption: 'By open', to: '/clients', people: [{ party: party('a'), open: 3, overdue: 0, value: 3 }], loaded: true, emptyText: 'None' } })
    expect(card.text()).toContain('3')
    const empty = await render(PeopleCard, { props: { title: 'Clients', caption: 'x', to: '/clients', people: [], loaded: true, emptyText: 'No clients yet.', addText: 'Invite one' } })
    expect(empty.text()).toContain('No clients yet.')
    expect(empty.text()).toContain('Invite one')
    const loading = await render(PeopleCard, { props: { title: 'Clients', caption: 'x', to: '/clients', people: [], loaded: false, emptyText: 'None' } })
    expect(loading.text()).not.toContain('None')
  })
})
