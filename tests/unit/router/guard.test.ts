import { describe, expect, it, vi } from 'vitest'
import type { RouteLocationNormalized } from 'vue-router'
import router, { guard } from '@/router'
import { useAuthStore } from '@/stores/auth'
import { makeUser } from '../../fixtures'
import type { User } from '@/types/auth'

/** Where the guard sends someone opening path: true to let them through. */
function open(path: string) {
  return guard(router.resolve(path) as RouteLocationNormalized)
}

function signedIn(user: User | null) {
  const auth = useAuthStore()
  auth.user = user
  auth.isInitialized = true
}

describe('the router guard', () => {
  it('asks who is signed in before deciding, once', async () => {
    const auth = useAuthStore()
    const initialize = vi.spyOn(auth, 'initialize').mockImplementation(async () => {
      auth.isInitialized = true
    })
    await open('/login')
    await open('/login')
    expect(initialize).toHaveBeenCalledOnce()
  })

  it('sends a guest to sign in, coming back where they were going', async () => {
    signedIn(null)
    expect(await open('/tasks/t-1')).toEqual({ name: 'login', query: { redirect: '/tasks/t-1' } })
    expect(await open('/dashboard')).toEqual({ name: 'login', query: {} })
    expect(await open('/invite/tok')).toBe(true)
  })

  it('sends someone signed in away from the guest pages, to their home', async () => {
    signedIn(makeUser())
    expect(await open('/login')).toBe('/dashboard')
    signedIn(makeUser({ role: 'admin' }))
    expect(await open('/register')).toBe('/admin')
  })

  it('keeps an admin to the panel and their settings', async () => {
    signedIn(makeUser({ role: 'admin' }))
    expect(await open('/tasks')).toBe('/admin')
    expect(await open('/settings')).toBe(true)
    expect(await open('/admin')).toBe(true)
  })

  it('opens a role’s pages to that role only', async () => {
    signedIn(makeUser())
    expect(await open('/clients')).toBe(true)
    expect(await open('/team')).toBe('/dashboard')
    signedIn(makeUser({ role: 'client' }))
    expect(await open('/freelancers')).toBe(true)
    expect(await open('/clients')).toBe('/dashboard')
    expect(await open('/admin')).toBe('/dashboard')
  })

  it('keeps the reports from a member of a client’s company', async () => {
    signedIn(makeUser({ role: 'client' }))
    expect(await open('/reports')).toBe(true)
    signedIn(makeUser({ role: 'client', member_of: { owner_id: 'o', name: 'Acme', role: 'member' } }))
    expect(await open('/reports/r-1')).toBe('/dashboard')
  })

  it('sends an unknown path home', () => {
    expect(router.resolve('/no/such/page').matched[0].redirect).toBe('/dashboard')
  })
})
