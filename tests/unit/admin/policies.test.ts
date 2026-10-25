import { describe, expect, it } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import AdminPoliciesView from '@/admin/views/AdminPoliciesView.vue'
import { t } from '@/i18n'
import type { AdminPolicy, PolicyKind } from '@/types/policies'
import { api, render, status, type Call } from '../../helpers'
import { $, button, click, type } from '../../dom'
import { admin } from '../../admin-fixtures'

const policy = (kind: PolicyKind, locale: 'en' | 'uk', over: Partial<AdminPolicy> = {}): AdminPolicy => ({
  kind,
  locale,
  body: `Write to [contact email].\n\n## ${kind} ${locale}`,
  custom: false,
  updated_at: null,
  updated_by: '',
  ...over,
})

function serve() {
  const all = (['privacy', 'terms', 'cookies'] as const).flatMap((k) => [policy(k, 'en'), policy(k, 'uk')])
  return api({
    'GET /admin/policies': { policies: all },
    'PUT /admin/policies/privacy/en': (c: Call) => ({
      policy: policy('privacy', 'en', { body: (c.body as { body: string }).body, custom: true, updated_at: new Date().toISOString(), updated_by: 'root@helpic.test' }),
    }),
    'DELETE /admin/policies/privacy/en': { policy: policy('privacy', 'en') },
  })
}

const editor = () => $('textarea') as HTMLTextAreaElement

describe('AdminPoliciesView', () => {
  it('shows the code, and behind the eye how it reads', async () => {
    serve()
    const page = await render(AdminPoliciesView, { path: '/admin/policies', user: admin() })
    expect(editor().value).toContain('## privacy en')
    // the code by default; the eye shows it as it reads, and back
    const eye = $(`button[aria-label="${t('policyAdmin.preview')}"]`)
    expect(eye?.getAttribute('aria-pressed')).toBe('false')
    await click(eye)
    expect($('textarea')).toBeNull()
    expect(page.findAll('h2').map((h) => h.text())).toContain('privacy en')
    await click(eye)
    expect(editor()).not.toBeNull()
    expect(button(t('policyAdmin.save')).disabled).toBe(true)
  })

  it('keeps a draft per policy and language, and saves it for everyone', async () => {
    const server = serve()
    const page = await render(AdminPoliciesView, { path: '/admin/policies', user: admin() })
    await type(editor(), '## Who we are\n\nAcme Ltd')
    expect(page.text()).toContain(t('policyAdmin.unsaved'))

    // Another policy and back: the draft is still there.
    await click(button(t('policies.names.terms')))
    expect(editor().value).toContain('## terms en')
    await click(button(t('policies.names.privacy')))
    expect(editor().value).toBe('## Who we are\n\nAcme Ltd')

    await click(button(t('policyAdmin.save')))
    expect(server.to('PUT /admin/policies/privacy/en')[0].body).toEqual({ body: '## Who we are\n\nAcme Ltd' })
    expect(page.text()).toContain('root@helpic.test')
    expect(page.text()).not.toContain(t('policyAdmin.unsaved'))
  })

  it('shows why the server refused the text', async () => {
    const server = serve()
    server.reply('PUT /admin/policies/privacy/en', status(400, { error: { code: 'VALIDATION_ERROR', message: 'Bad', fields: { body: 'The policy is too long' } } }))
    const page = await render(AdminPoliciesView, { path: '/admin/policies', user: admin() })
    await type(editor(), 'Too long')
    await click(button(t('policyAdmin.save')))
    expect(page.text()).toContain('The policy is too long')
  })

  it('puts the default back once asked', async () => {
    const server = serve()
    server.reply('GET /admin/policies', {
      policies: [policy('privacy', 'en', { body: 'Mine', custom: true, updated_at: new Date().toISOString(), updated_by: 'root@helpic.test' }), policy('privacy', 'uk')],
    })
    const page = await render(AdminPoliciesView, { path: '/admin/policies', user: admin() })
    await click(button(t('policyAdmin.reset')))
    await click([...document.querySelectorAll<HTMLButtonElement>('[role="dialog"] button')].find((b) => b.textContent?.trim() === t('policyAdmin.reset'))!)
    await flushPromises()
    expect(server.to('DELETE /admin/policies/privacy/en')).toHaveLength(1)
    expect(editor().value).toContain('## privacy en')
    expect(page.text()).not.toContain(t('policyAdmin.reset'))
  })
})
