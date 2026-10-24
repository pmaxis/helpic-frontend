import { describe, expect, it, vi } from 'vitest'
import { http, ApiRequestError } from '@/services/api'
import { useAuthStore } from '@/stores/auth'
import { currentLocale } from '@/i18n'
import { makeUser } from '../../fixtures'

describe('auth getters', () => {
  it('tells the roles apart', () => {
    const auth = useAuthStore()
    expect(auth.isAuthenticated).toBe(false)

    auth.user = makeUser()
    expect([auth.isAuthenticated, auth.isFreelancer, auth.isClient, auth.isAdmin]).toEqual([true, true, false, false])

    auth.user = makeUser({ role: 'client' })
    expect([auth.isClient, auth.isTeamOwner, auth.isTeamMember]).toEqual([true, true, false])

    auth.user = makeUser({ role: 'client', member_of: { owner_id: 'o', name: 'Acme', role: 'contractor' } })
    expect([auth.isTeamOwner, auth.isTeamMember, auth.isContractor]).toEqual([false, true, true])
  })

  it('opens the admin panel only to an admin with two-factor on', () => {
    const auth = useAuthStore()
    auth.user = makeUser({ role: 'admin' })
    expect(auth.canOpenAdmin).toBe(false)
    auth.user = makeUser({ role: 'admin', two_factor: true })
    expect(auth.canOpenAdmin).toBe(true)
  })
})

describe('initialize', () => {
  it('asks the backend once who is signed in, and follows their language', async () => {
    const get = vi.spyOn(http, 'get').mockResolvedValue({ data: { user: makeUser({ locale: 'uk' }) } })
    const auth = useAuthStore()
    await auth.initialize()
    await auth.initialize()
    expect(get).toHaveBeenCalledOnce()
    expect(get).toHaveBeenCalledWith('/me')
    expect(auth.user?.id).toBe('u-freelancer')
    expect(currentLocale()).toBe('uk')
  })

  it('starts signed out when the backend says no, or can’t be reached', async () => {
    const auth = useAuthStore()
    vi.spyOn(http, 'get').mockRejectedValueOnce(new ApiRequestError(401, { code: 'UNAUTHORIZED', message: '' }))
    await auth.fetchCurrentUser()
    expect(auth.user).toBeNull()

    vi.spyOn(http, 'get').mockRejectedValueOnce(new Error('offline'))
    await auth.fetchCurrentUser()
    expect(auth.user).toBeNull()
  })
})

describe('signing in and out', () => {
  it('signs in, busy while it waits', async () => {
    const auth = useAuthStore()
    let answer!: (v: unknown) => void
    vi.spyOn(http, 'post').mockReturnValue(new Promise((r) => (answer = r)))
    const signingIn = auth.login({ email: 'olena@example.test', password: 'pw' })
    expect(auth.isLoading).toBe(true)
    answer({ data: { user: makeUser() } })
    await signingIn
    expect([auth.isLoading, auth.isInitialized, auth.isAuthenticated]).toEqual([false, true, true])
  })

  it('is no longer busy after a refused sign-in', async () => {
    const auth = useAuthStore()
    vi.spyOn(http, 'post').mockRejectedValue(new Error('wrong password'))
    await expect(auth.login({ email: 'a@b.c', password: 'x' })).rejects.toThrow()
    expect(auth.isLoading).toBe(false)
    expect(auth.user).toBeNull()
  })

  it('registers without signing in: the account waits for its link', async () => {
    const auth = useAuthStore()
    const post = vi.spyOn(http, 'post').mockResolvedValue({ data: { email: 'a@b.c' } })
    await auth.register({ email: 'a@b.c', name: 'A', password: 'pw', password_confirmation: 'pw' })
    expect(post).toHaveBeenCalledWith('/auth/register', expect.objectContaining({ email: 'a@b.c' }))
    expect(auth.user).toBeNull()
  })

  it('signs in from a sign-up link', async () => {
    const auth = useAuthStore()
    vi.spyOn(http, 'post').mockResolvedValue({ data: { user: makeUser() } })
    const user = await auth.confirmSignup('tok')
    expect(user.id).toBe('u-freelancer')
    expect(auth.isInitialized).toBe(true)
  })

  it('drops the user on sign-out even when the request fails', async () => {
    const auth = useAuthStore()
    auth.user = makeUser()
    vi.spyOn(http, 'post').mockRejectedValue(new Error('offline'))
    await auth.logout()
    expect(auth.user).toBeNull()
    expect(auth.isLoading).toBe(false)
  })

  it('takes the user an invitation signed in, and forgets them when the session expires', () => {
    const auth = useAuthStore()
    auth.setUser(makeUser({ role: 'client' }))
    expect(auth.isClient).toBe(true)
    auth.handleSessionExpired()
    expect(auth.user).toBeNull()
  })
})

describe('account changes', () => {
  it('saves the name, currency and rate, keeping what the backend returns', async () => {
    const auth = useAuthStore()
    const put = vi.spyOn(http, 'put')
    put.mockResolvedValueOnce({ data: { user: makeUser({ first_name: 'Ola' }) } })
    await auth.updateName('Ola', 'K')
    expect(put).toHaveBeenLastCalledWith('/me', { first_name: 'Ola', last_name: 'K' })
    expect(auth.user?.first_name).toBe('Ola')

    put.mockResolvedValueOnce({ data: { user: makeUser({ currency: 'EUR' }) } })
    await auth.setCurrency('EUR')
    expect(auth.user?.currency).toBe('EUR')

    put.mockResolvedValueOnce({ data: { user: makeUser({ hourly_rate_cents: 4000 }) } })
    await auth.setHourlyRate('40')
    expect(put).toHaveBeenLastCalledWith('/me/rate', { rate: '40' })
    expect(auth.user?.hourly_rate_cents).toBe(4000)
  })

  it('returns where an email change went, and changes the password', async () => {
    const auth = useAuthStore()
    const put = vi.spyOn(http, 'put').mockResolvedValueOnce({ data: { pending_email: 'new@example.test' } })
    expect(await auth.changeEmail({ email: 'new@example.test', current_password: 'pw' })).toBe('new@example.test')
    put.mockResolvedValueOnce({ data: {} })
    await auth.changePassword({ current_password: 'a', password: 'b', password_confirmation: 'b' })
    expect(put).toHaveBeenLastCalledWith('/me/password', { current_password: 'a', password: 'b', password_confirmation: 'b' })
  })

  it('switches the language at once, and on the account only when signed in', async () => {
    const auth = useAuthStore()
    const put = vi.spyOn(http, 'put').mockResolvedValue({ data: { user: makeUser({ locale: 'uk' }) } })
    await auth.setLocale('uk')
    expect(currentLocale()).toBe('uk')
    expect(put).not.toHaveBeenCalled()

    auth.user = makeUser()
    await auth.setLocale('uk')
    expect(put).toHaveBeenCalledWith('/me/locale', { locale: 'uk' })
    expect(auth.user?.locale).toBe('uk')
  })
})
