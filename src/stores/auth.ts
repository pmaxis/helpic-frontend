import { defineStore } from 'pinia'
import { http, ApiRequestError } from '@/services/api'
import { isLocale, setLocale, type Locale } from '@/i18n'
import type {
  ChangeEmailPayload,
  ChangePasswordPayload,
  DeleteAccountPayload,
  LoginPayload,
  RegisterPayload,
  User,
  UserResponse,
} from '@/types/auth'

interface AuthState {
  user: User | null
  isLoading: boolean
  isInitialized: boolean
}

/** A signed-in user reads Helpic in their account's language. */
function follow(user: User | null): User | null {
  if (user && isLocale(user.locale)) setLocale(user.locale)
  return user
}

export const useAuthStore = defineStore('auth', {
  state: (): AuthState => ({
    user: null,
    isLoading: false,
    isInitialized: false,
  }),

  getters: {
    isAuthenticated: (state): boolean => state.user !== null,
    isFreelancer: (state): boolean => state.user?.role === 'freelancer',
    isClient: (state): boolean => state.user?.role === 'client',
    /** Runs the platform: the admin panel and their settings, no work. */
    isAdmin: (state): boolean => state.user?.role === 'admin',
    /** An admin who can open the panel: it needs two-factor sign-in on. */
    canOpenAdmin: (state): boolean => state.user?.role === 'admin' && state.user.two_factor,
    /** A member of a client's company: acts for it, but doesn't see its reports. */
    isTeamMember: (state): boolean => !!state.user?.member_of,
    /** A contractor of a client's company: sees only the tasks they set or were added to. */
    isContractor: (state): boolean => state.user?.member_of?.role === 'contractor',
    /** The client a freelancer invited: owns their company and its team. */
    isTeamOwner: (state): boolean => state.user?.role === 'client' && !state.user?.member_of,
  },

  actions: {
    /**
     * Called once on app start. Asks the backend who the current user is and
     * restores the authenticated state after a page reload. The backend's
     * /api/me is the single source of truth — Pinia state alone never implies
     * authentication.
     */
    async initialize(): Promise<void> {
      if (this.isInitialized) return
      await this.fetchCurrentUser()
      this.isInitialized = true
    },

    async fetchCurrentUser(): Promise<void> {
      try {
        const { data } = await http.get<UserResponse>('/me')
        this.user = follow(data.user)
      } catch (error) {
        if (error instanceof ApiRequestError && error.status === 401) {
          this.user = null
          return
        }
        // Network / server errors: stay unauthenticated but don't crash boot.
        this.user = null
      }
    },

    async login(payload: LoginPayload): Promise<void> {
      this.isLoading = true
      try {
        const { data } = await http.post<UserResponse>('/auth/login', payload)
        this.user = follow(data.user)
        this.isInitialized = true
      } finally {
        this.isLoading = false
      }
    },

    async register(payload: RegisterPayload): Promise<void> {
      this.isLoading = true
      try {
        // Emails a confirmation link. The account does not exist until it's opened.
        await http.post<{ email: string }>('/auth/register', payload)
      } finally {
        this.isLoading = false
      }
    },

    /** Opens a sign-up link: creates the account and signs this browser in. */
    async confirmSignup(token: string): Promise<User> {
      const { data } = await http.post<UserResponse>('/auth/signups/confirm', { token })
      this.user = follow(data.user)
      this.isInitialized = true
      return data.user
    },

    async logout(): Promise<void> {
      this.isLoading = true
      try {
        await http.post('/auth/logout')
      } catch {
        // Even if the request fails, drop local state.
      } finally {
        this.user = null
        this.isLoading = false
      }
    },

    async updateName(firstName: string, lastName: string): Promise<void> {
      const { data } = await http.put<UserResponse>('/me', { first_name: firstName, last_name: lastName })
      this.user = follow(data.user)
    },

    /** Emails a confirmation link to the new address; returns it. The email changes once it's opened. */
    async changeEmail(payload: ChangeEmailPayload): Promise<string> {
      const { data } = await http.put<{ pending_email: string }>('/me/email', payload)
      return data.pending_email
    },

    /**
     * Switches the language: at once here, and on the account when signed in,
     * so emails and Telegram follow.
     */
    async setLocale(locale: Locale): Promise<void> {
      setLocale(locale)
      if (!this.user) return
      const { data } = await http.put<UserResponse>('/me/locale', { locale })
      this.user = data.user
    },

    async setCurrency(currency: string): Promise<void> {
      const { data } = await http.put<UserResponse>('/me/currency', { currency })
      this.user = follow(data.user)
    },

    /** Sets what a freelancer charges for an hour ("40", "37.50"), or clears it with null. */
    async setHourlyRate(rate: string | null): Promise<void> {
      const { data } = await http.put<UserResponse>('/me/rate', { rate })
      this.user = follow(data.user)
    },

    async changePassword(payload: ChangePasswordPayload): Promise<void> {
      await http.put<UserResponse>('/me/password', payload)
    },

    /**
     * Deletes the account for good; takes the password and, with two-factor
     * on, a code. The backend signs this browser out.
     */
    async deleteAccount(payload: DeleteAccountPayload): Promise<void> {
      await http.delete('/me', { data: payload })
      this.user = null
    },

    /** Accepting an invitation signs the client in; the backend returns the user. */
    setUser(user: User): void {
      this.user = follow(user)
      this.isInitialized = true
    },

    /** Invoked by the API layer when a 401 is seen mid-session. */
    handleSessionExpired(): void {
      this.user = null
    },
  },
})
