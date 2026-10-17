import { defineStore } from 'pinia'
import { http, ApiRequestError } from '@/services/api'
import type {
  ChangeEmailPayload,
  ChangePasswordPayload,
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
    /** A member of a client's company: acts for it, but doesn't see its reports. */
    isTeamMember: (state): boolean => !!state.user?.member_of,
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
        this.user = data.user
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
        this.user = data.user
        this.isInitialized = true
      } finally {
        this.isLoading = false
      }
    },

    async register(payload: RegisterPayload): Promise<void> {
      this.isLoading = true
      try {
        // Registration does not create a session; the user logs in afterwards.
        await http.post<UserResponse>('/auth/register', payload)
      } finally {
        this.isLoading = false
      }
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
      this.user = data.user
    },

    /** Emails a confirmation link to the new address; returns it. The email changes once it's opened. */
    async changeEmail(payload: ChangeEmailPayload): Promise<string> {
      const { data } = await http.put<{ pending_email: string }>('/me/email', payload)
      return data.pending_email
    },

    async setCurrency(currency: string): Promise<void> {
      const { data } = await http.put<UserResponse>('/me/currency', { currency })
      this.user = data.user
    },

    async changePassword(payload: ChangePasswordPayload): Promise<void> {
      await http.put<UserResponse>('/me/password', payload)
    },

    /** Accepting an invitation signs the client in; the backend returns the user. */
    setUser(user: User): void {
      this.user = user
      this.isInitialized = true
    },

    /** Invoked by the API layer when a 401 is seen mid-session. */
    handleSessionExpired(): void {
      this.user = null
    },
  },
})
