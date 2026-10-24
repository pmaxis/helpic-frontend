import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import PasswordInput from '@/components/auth/PasswordInput.vue'
import TwoFactorCodeInput from '@/components/auth/TwoFactorCodeInput.vue'
import InviteUnavailable from '@/components/auth/InviteUnavailable.vue'
import AuthOutcome from '@/components/auth/AuthOutcome.vue'
import RunningTimer from '@/components/navigation/RunningTimer.vue'
import { t } from '@/i18n'
import { useTimerStore } from '@/stores/timer'
import { useToasts } from '@/composables/useToasts'
import { api, render, status } from '../../../helpers'
import { button, click } from '../../../dom'
import { makeTimeEntry } from '../../../fixtures'

describe('PasswordInput', () => {
  it('shows and hides the password, passing it up', async () => {
    const input = mount(PasswordInput, { props: { modelValue: '', label: 'Password', autocomplete: 'current-password', hint: 'At least 8' } })
    expect(input.get('input').attributes('type')).toBe('password')
    await input.get('button').trigger('click')
    expect(input.get('input').attributes('type')).toBe('text')
    expect(input.get('button').attributes('aria-label')).toBe(t('passwordInput.hide'))
    await input.get('input').setValue('secret')
    expect(input.emitted('update:modelValue')).toEqual([['secret']])
    expect(input.text()).toContain('At least 8')
    await input.setProps({ error: 'Required' })
    expect(input.text()).toContain('Required')
  })
})

describe('TwoFactorCodeInput', () => {
  it('passes the code up and shows its error', async () => {
    const input = mount(TwoFactorCodeInput, { props: { modelValue: '', label: 'Code', hint: 'Six digits', size: 'lg' } })
    await input.get('input').setValue('123456')
    expect(input.emitted('update:modelValue')).toEqual([['123456']])
    await input.setProps({ error: 'Wrong code' })
    expect(input.text()).toContain('Wrong code')
    expect(input.get('input').attributes('autocomplete')).toBe('one-time-code')
  })
})

describe('InviteUnavailable and AuthOutcome', () => {
  it('says why an invite can’t be used, offering to try again when the lookup failed', async () => {
    const reload = vi.fn()
    Object.defineProperty(window, 'location', { value: { ...window.location, reload }, configurable: true })
    await render(InviteUnavailable, { props: { message: 'Could not load' } })
    await click(button(t('invite.tryAgain')))
    expect(reload).toHaveBeenCalled()
    const gone = await render(InviteUnavailable, { props: { message: 'Revoked', gone: true } })
    expect(gone.text()).toContain('Revoked')
    expect(gone.text()).toContain(t('invite.next.ask.title'))
  })

  it('lists the next steps with one action', async () => {
    const outcome = await render(AuthOutcome, {
      props: { title: 'Done', subtitle: 'All set', steps: [{ icon: 'mail', title: 'Inbox', text: 'Look' }, { icon: 'enter', title: 'Sign in', text: 'Go' }], actionTo: '/login', actionLabel: 'Sign in' },
    })
    expect(outcome.text()).toMatch(/Done.*All set.*Inbox.*Sign in/)
    expect(outcome.find('a[href="/login"]').exists()).toBe(true)
  })
})

describe('RunningTimer', () => {
  it('is nothing while no timer runs, and says when it can’t stop', async () => {
    const view = await render(RunningTimer)
    expect(view.text()).toBe('')
    api({ 'POST /timer/stop': status(500, { error: { code: 'X', message: 'Nope' } }) })
    useTimerStore().set(makeTimeEntry({ task_title: 'Hero', running_since: new Date().toISOString() }))
    await view.vm.$nextTick()
    expect(view.text()).toContain('Hero')
    await click(button(t('timelog.stopTimer')))
    expect(useToasts().toasts.at(-1)?.message).toBe('Nope')
    await view.setProps({ compact: true })
    expect(view.text()).not.toContain('Hero')
    await view.find('a').exists() && view.find('a').trigger('click')
    useTimerStore().reset()
  })
})
