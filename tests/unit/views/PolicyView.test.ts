import { describe, expect, it } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import PolicyView from '@/views/PolicyView.vue'
import { setLocale, t } from '@/i18n'
import { api, render, status } from '../../helpers'
import { button, click } from '../../dom'
import { makeUser } from '../../fixtures'

const policy = (over = {}) => ({ kind: 'privacy', locale: 'en', body: '## Who we are\n\nHelpic.\n\n- Email\n- Name', custom: false, updated_at: null, ...over })

describe('PolicyView', () => {
  it('shows the policy to a guest, in the interface’s language, drawn beside it', async () => {
    const server = api({ 'GET /policies/privacy': { policy: policy() } })
    const page = await render(PolicyView, { path: '/privacy', props: { kind: 'privacy' }, user: null })
    expect(page.find('h1').text()).toBe(t('policies.names.privacy'))
    expect(page.find('h2').text()).toBe('Who we are')
    expect(page.find('article').findAll('li').map((li) => li.text())).toEqual(['Email', 'Name'])
    // the headings are anchors, and the dark side draws the policy read so far
    expect(page.find('h2').attributes('id')).toBe('section-1')
    expect(page.text()).toContain(t('policies.leads.privacy'))
    expect(page.text()).toContain(t('policies.read', { pct: 100 }))
    expect(page.text()).not.toContain(t('policies.updated', { date: '' }).trim())
    expect(server.to('GET /policies/privacy')[0].params).toEqual({ locale: 'en' })
    // the others only in the footer, this one marked as open
    expect(page.find('footer a[href="/terms"]').exists()).toBe(true)
    expect(page.find('footer a[href="/privacy"]').attributes('aria-current')).toBe('page')
    expect(page.find('a[aria-label="Helpic"]').attributes('href')).toBe('/login')

    setLocale('uk')
    await flushPromises()
    expect(server.to('GET /policies/privacy').at(-1)?.params).toEqual({ locale: 'uk' })
    setLocale('en')
  })

  it('says when an admin last changed it, and leads a signed-in user back to work', async () => {
    api({ 'GET /policies/terms': { policy: policy({ kind: 'terms', custom: true, updated_at: '2030-03-05T10:00:00Z' }) } })
    const page = await render(PolicyView, { path: '/terms', props: { kind: 'terms' }, user: makeUser() })
    expect(page.text()).toContain(t('policies.updated', { date: '5 Mar 2030' }))
    expect(page.find('a[aria-label="Helpic"]').attributes('href')).toBe('/dashboard')
  })

  it('offers to try again when it can’t load', async () => {
    const server = api({ 'GET /policies/cookies': status(500) })
    const page = await render(PolicyView, { path: '/cookies', props: { kind: 'cookies' }, user: null })
    expect(page.text()).toContain(t('policies.loadFailed'))
    server.reply('GET /policies/cookies', { policy: policy({ kind: 'cookies', body: 'Only the needed ones.' }) })
    await click(button(t('policies.retry')))
    expect(page.text()).toContain('Only the needed ones.')
  })
})
