import { describe, expect, it } from 'vitest'
import NotFoundView from '@/views/NotFoundView.vue'
import { t } from '@/i18n'
import { api, render } from '../../helpers'
import { makeUser } from '../../fixtures'

describe('NotFoundView', () => {
  it('shows a guest the way to sign in', async () => {
    api()
    const page = await render(NotFoundView, { path: '/no/such/page', user: null })
    expect(page.text()).toContain(t('notFound.title'))
    expect(page.find('a[href="/login"]').text()).toBe(t('notFound.toSignIn'))
  })

  it('keeps someone signed in inside the app, saying what they opened', async () => {
    api({ 'GET /notifications/unread-count': { count: 0 } })
    const page = await render(NotFoundView, { path: '/no/such/page', user: makeUser() })
    expect(page.text()).toContain(t('notFound.title'))
    expect(page.text()).toContain('/no/such/page')
    expect(page.findAll('a[href="/dashboard"]').some((a) => a.text() === t('notFound.toDashboard'))).toBe(true)
  })

  it('sends an admin back to the panel', async () => {
    api()
    const page = await render(NotFoundView, { path: '/no/such/page', user: makeUser({ role: 'admin' }) })
    expect(page.findAll('a[href="/admin"]').some((a) => a.text() === t('notFound.toPanel'))).toBe(true)
  })
})
