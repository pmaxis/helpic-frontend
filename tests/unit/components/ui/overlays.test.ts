import { afterEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import Modal from '@/components/ui/Modal.vue'
import ConfirmDialog from '@/components/ui/ConfirmDialog.vue'
import Pagination from '@/components/ui/Pagination.vue'
import FilterPill from '@/components/ui/FilterPill.vue'
import ViewToggle from '@/components/ui/ViewToggle.vue'
import ToastHost from '@/components/ui/ToastHost.vue'
import CookieNotice from '@/components/ui/CookieNotice.vue'
import LocaleSwitcher from '@/components/ui/LocaleSwitcher.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import PageHeader from '@/components/ui/PageHeader.vue'
import { toast, useToasts } from '@/composables/useToasts'
import { currentLocale } from '@/i18n'
import { http, ApiRequestError } from '@/services/api'
import { useAuthStore } from '@/stores/auth'
import { $, click, pressOutside, texts } from '../../../dom'
import { makeRouter } from '../../../helpers'
import { makeUser } from '../../../fixtures'

afterEach(() => {
  useToasts().toasts.splice(0)
})

describe('Modal', () => {
  it('shows its title and slots, and closes on Escape or its button', async () => {
    const modal = mount(Modal, { props: { title: 'Edit task', size: 'lg' }, slots: { default: 'Body', footer: 'Footer' }, attachTo: document.body })
    expect($('[role="dialog"]')?.textContent).toContain('Edit task')
    expect(document.body.textContent).toContain('Footer')
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }))
    expect(modal.emitted('close')).toHaveLength(1)
    await click('[role="dialog"] button[aria-label="Close"]')
    expect(modal.emitted('close')).toHaveLength(2)
  })
})

describe('ConfirmDialog', () => {
  it('asks, then confirms or cancels; it can’t be cancelled while busy', async () => {
    const dialog = mount(ConfirmDialog, { props: { open: true, title: 'Delete?', description: 'Gone for good.' }, attachTo: document.body })
    expect(document.body.textContent).toContain('Gone for good.')
    const buttons = () => [...document.querySelectorAll<HTMLButtonElement>('[role="dialog"] button')]
    await click(buttons().find((b) => b.textContent?.trim() === 'Delete')!)
    expect(dialog.emitted('confirm')).toHaveLength(1)
    await click(buttons().find((b) => b.textContent?.trim() === 'Cancel')!)
    expect(dialog.emitted('update:open')).toEqual([[false]])

    await dialog.setProps({ loading: true })
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    expect(dialog.emitted('update:open')).toHaveLength(1)
    await dialog.setProps({ open: false })
    expect($('[role="dialog"]')).toBeNull()
  })
})

describe('Pagination', () => {
  const pages = (page: number, total: number) =>
    mount(Pagination, { props: { page, total, limit: 10 } })
      .findAll('button')
      .map((b) => b.text())
      .filter((t) => /^\d+$/.test(t))

  it('is hidden when everything fits on one page', () => {
    expect(mount(Pagination, { props: { page: 1, total: 10, limit: 10 } }).html()).not.toContain('button')
  })

  it('shows every page up to seven, then the ends and around the current one', () => {
    expect(pages(1, 70)).toEqual(['1', '2', '3', '4', '5', '6', '7'])
    expect(pages(1, 120)).toEqual(['1', '2', '3', '4', '12'])
    expect(pages(6, 120)).toEqual(['1', '5', '6', '7', '12'])
    expect(pages(12, 120)).toEqual(['1', '9', '10', '11', '12'])
  })

  it('says what is shown and moves between pages', async () => {
    const pagination = mount(Pagination, { props: { page: 2, total: 25, limit: 10 } })
    expect(pagination.text()).toMatch(/11.*20.*25/)
    const buttons = pagination.findAll('button')
    await buttons[0].trigger('click')
    await buttons.at(-1)!.trigger('click')
    await buttons.find((b) => b.text() === '2')!.trigger('click')
    expect(pagination.emitted('update:page')).toEqual([[1], [3]])
  })
})

describe('FilterPill', () => {
  it('opens its panel, closing on a press outside or when told', async () => {
    const pill = mount(FilterPill, { props: { label: 'Status', value: 'Any', active: true, align: 'right' }, slots: { default: '<p class="panel">Options</p>' }, attachTo: document.body })
    expect(pill.text()).toContain('Status')
    await pill.get('button').trigger('click')
    expect(pill.find('.panel').exists()).toBe(true)
    await pressOutside()
    expect(pill.find('.panel').exists()).toBe(false)
    await pill.get('button').trigger('click')
    await pill.get('button').trigger('click')
    expect(pill.find('.panel').exists()).toBe(false)
    await pill.get('button').trigger('click')
    ;(pill.vm as unknown as { close: (refocus?: boolean) => void }).close(true)
    await nextTick()
    expect(pill.find('.panel').exists()).toBe(false)
  })
})

describe('ViewToggle', () => {
  it('switches between the views, List and Board by default', async () => {
    const toggle = mount(ViewToggle, { props: { modelValue: 'list' } })
    expect(toggle.findAll('button').map((b) => b.text())).toEqual(['List', 'Board'])
    await toggle.findAll('button')[1].trigger('click')
    expect(toggle.emitted('update:modelValue')).toEqual([['board']])

    const custom = mount(ViewToggle, { props: { modelValue: 'cards', options: [{ value: 'cards', icon: 'cards', label: 'Cards' }] } })
    expect(custom.text()).toContain('Cards')
  })
})

describe('ToastHost', () => {
  it('shows the toasts, each dismissed by its button', async () => {
    const host = mount(ToastHost, { attachTo: document.body })
    toast.success('Saved')
    toast.error('Failed')
    await nextTick()
    expect(texts('[role="status"], [role="alert"]').join(' ')).toMatch(/Saved.*Failed/)
    await host.findAll('button')[0].trigger('click')
    expect(useToasts().toasts.map((t) => t.message)).toEqual(['Failed'])
  })
})

describe('CookieNotice', () => {
  it('tells about cookies until it is accepted, then stays away', async () => {
    localStorage.removeItem('helpic:cookie-notice-seen')
    const global = { plugins: [makeRouter()] }
    const notice = mount(CookieNotice, { global })
    expect(notice.text()).toContain('We use cookies')
    expect(notice.find('a').attributes('href')).toBe('/cookies')
    await notice.find('button').trigger('click')
    expect(notice.find('section').exists()).toBe(false)
    expect(mount(CookieNotice, { global }).find('section').exists()).toBe(false)
  })
})

describe('LocaleSwitcher', () => {
  it('switches the language, and says so when the account refuses', async () => {
    const switcher = mount(LocaleSwitcher)
    await switcher.findAll('button')[1].trigger('click')
    expect(currentLocale()).toBe('uk')
    await switcher.findAll('button')[1].trigger('click')

    useAuthStore().user = makeUser()
    vi.spyOn(http, 'put').mockRejectedValue(new ApiRequestError(500, { code: 'X', message: 'Nope' }))
    await switcher.findAll('button')[0].trigger('click')
    await vi.waitFor(() => expect(useToasts().toasts.at(-1)?.message).toBe('Nope'))
  })
})

describe('EmptyState and PageHeader', () => {
  it('render what they are given', () => {
    expect(mount(EmptyState, { props: { title: 'Nothing yet', description: 'Add one' }, slots: { illustration: '<i>art</i>', default: '<button>Add</button>' } }).text()).toMatch(/Nothing yet.*Add one/)
    expect(mount(PageHeader, { props: { title: 'Tasks', description: 'All of them' }, slots: { actions: '<button>New</button>' } }).text()).toMatch(/Tasks.*All of them.*New/)
  })
})
