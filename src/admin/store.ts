import { defineStore } from 'pinia'
import { useAuthStore } from '@/stores/auth'
import { fetchAdminAccess } from './api'
import type { AdminAccess } from './types'

/**
 * Whether the signed-in user is an admin, asked once per account. It only
 * decides what the interface shows: the backend checks every admin request.
 */
export const useAdminStore = defineStore('admin', {
  state: () => ({
    access: null as AdminAccess | null,
    /** The account the answer is for: another sign-in asks again. */
    userId: null as string | null,
  }),

  getters: {
    isAdmin: (state): boolean => !!state.access?.admin,
    /** An admin who can open the panel: two-factor is on. */
    canOpen: (state): boolean => !!state.access?.admin && state.access.two_factor,
  },

  actions: {
    /** Asks the backend, unless it already answered for this account; force asks again (two-factor may have changed). */
    async load(force = false): Promise<void> {
      const userId = useAuthStore().user?.id ?? null
      if (!userId) {
        this.$reset()
        return
      }
      if (!force && this.access && this.userId === userId) return
      try {
        this.access = await fetchAdminAccess()
      } catch {
        this.access = { admin: false, two_factor: false }
      }
      this.userId = userId
    },
  },
})
