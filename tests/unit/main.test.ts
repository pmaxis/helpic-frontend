import { describe, expect, it, vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'

const handlers: (() => void)[] = []

vi.mock('@/services/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/services/api')>()),
  onUnauthorized: (fn: () => void) => handlers.push(fn),
}))
vi.mock('@/App.vue', () => ({ default: { render: () => null } }))

describe('main', () => {
  it('signs out everywhere when the session expires, and sends a signed-in page to sign in', async () => {
    document.body.innerHTML = '<div id="app"></div>'
    const { http } = await import('@/services/api')
    vi.spyOn(http, 'get').mockResolvedValue({ data: { user: { id: 'u', role: 'freelancer', locale: 'en', two_factor: false, member_of: null } } })
    await import('@/main')
    const router = (await import('@/router')).default
    await router.push('/settings')
    await flushPromises()

    const { useAuthStore } = await import('@/stores/auth')
    const { useToasts } = await import('@/composables/useToasts')
    expect(useAuthStore().isAuthenticated).toBe(true)

    handlers[0]()
    expect(useAuthStore().user).toBeNull()
    await vi.waitFor(() => expect(router.currentRoute.value.name).toBe('login'), { timeout: 5000 })
    expect(useToasts().toasts.at(-1)?.tone).toBe('info')
  })
})
