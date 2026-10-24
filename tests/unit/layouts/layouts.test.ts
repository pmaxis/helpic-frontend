import { afterEach, describe, expect, it, vi } from 'vitest'
import { h } from 'vue'
import DashboardLayout from '@/layouts/DashboardLayout.vue'
import AuthLayout from '@/layouts/AuthLayout.vue'
import App from '@/App.vue'
import { t } from '@/i18n'
import { useAuthStore } from '@/stores/auth'
import { useNotificationsStore } from '@/stores/notifications'
import { useTasksStore } from '@/stores/tasks'
import { useTimerStore } from '@/stores/timer'
import { toast } from '@/composables/useToasts'
import { api, render } from '../../helpers'
import { $, $$, button, click } from '../../dom'
import { makeTask, makeTimeEntry, makeUser } from '../../fixtures'

afterEach(() => {
  useNotificationsStore().stopPolling()
  useTimerStore().reset()
})

const page = { default: () => h('p', { class: 'page' }, 'The page') }

describe('DashboardLayout', () => {
  it('shows the role’s sidebar and the user, and starts the polling and the timer', async () => {
    const server = api({ 'GET /notifications/unread-count': { unread: 2 }, 'GET /timer': { timer: null } })
    const layout = await render(DashboardLayout, { slots: page, path: '/dashboard', user: makeUser() })
    expect(layout.text()).toContain('The page')
    expect(layout.text()).toContain(t('nav.clients'))
    expect(layout.text()).toContain('OF')
    expect(server.to('GET /timer')).toHaveLength(1)
    expect($(`[aria-label="${t('bell.unreadAria', { n: 2 })}"]`)).not.toBeNull()
  })

  it('keeps a team member out of the owner’s pages, and an admin away from work', async () => {
    api()
    const member = await render(DashboardLayout, { slots: page, path: '/dashboard', user: makeUser({ role: 'client', member_of: { owner_id: 'o', name: 'Acme', role: 'member' } }) })
    expect(member.text()).not.toContain(t('nav.reports'))
    expect(member.find('a[href="/team"]').exists()).toBe(true)

    document.body.innerHTML = ''
    const server = api()
    const admin = await render(DashboardLayout, { slots: page, path: '/admin', user: makeUser({ role: 'admin', name: '', email: 'root@x' }) })
    expect(admin.text()).toContain('RO')
    expect(server.to('GET /notifications/unread-count')).toHaveLength(0)
    expect($(`[aria-label="${t('bell.title')}"]`)).toBeNull()
  })

  it('folds the sidebar and remembers it, and opens it on a phone', async () => {
    api()
    const layout = await render(DashboardLayout, { slots: page, path: '/dashboard', user: makeUser() })
    await click(button(t('sidebar.toggle')))
    expect(localStorage.getItem('helpic:sidebar-collapsed')).toBe('1')
    await click(button(t('sidebar.openMenu')))
    expect(layout.html()).toContain('translate-x-0')
  })

  it('signs out, forgetting the account’s data, and goes to sign in', async () => {
    const server = api()
    useTasksStore().tasks = [makeTask()]
    const layout = await render(DashboardLayout, { slots: page, path: '/dashboard', user: makeUser() })
    await click(button(t('sidebar.logOut')))
    expect(server.to('POST /auth/logout')).toHaveLength(1)
    expect(useAuthStore().user).toBeNull()
    expect(useTasksStore().tasks).toEqual([])
    await vi.waitFor(() => expect(layout.router.currentRoute.value.name).toBe('login'))
  })

  it('shows the running timer, and stops it', async () => {
    const server = api({
      'GET /timer': { timer: makeTimeEntry({ task_title: 'Hero', running_since: new Date().toISOString() }) },
      'POST /timer/stop': { entry: makeTimeEntry() },
    })
    await render(DashboardLayout, { slots: page, path: '/dashboard', user: makeUser() })
    expect(document.body.textContent).toContain('Hero')
    await click($$(`[aria-label="${t('timelog.stopTimer')}"]`)[0])
    expect(server.to('POST /timer/stop')).toHaveLength(1)
    expect(document.body.textContent).not.toContain('Hero')
  })
})

describe('AuthLayout and App', () => {
  it('frames the guest pages, the light following the pointer', async () => {
    const layout = await render(AuthLayout, { slots: page, path: '/login' })
    expect(layout.text()).toContain('The page')
    expect(layout.text()).toContain(String(new Date().getFullYear()))
    const side = layout.find('[style*="--x"], [style]')
    side.element.dispatchEvent(Object.assign(new Event('pointermove'), { clientX: 10, clientY: 20 }))
  })

  it('renders the page the route opens, with the toasts over it', async () => {
    api({ 'GET /me': { user: makeUser() } })
    const app = await render(App, { path: '/login', user: null })
    toast.info('Hello')
    await app.vm.$nextTick()
    expect(document.body.textContent).toContain('Hello')
  })
})
