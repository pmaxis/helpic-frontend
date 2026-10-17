import { defineStore } from 'pinia'
import { http } from '@/services/api'
import type { AppNotification } from '@/types/notifications'

const POLL_MS = 30_000

interface NotificationsState {
  items: AppNotification[]
  unread: number
  loaded: boolean
}

let timer: number | undefined

/** The user's notifications; the unread count is polled while signed in. */
export const useNotificationsStore = defineStore('notifications', {
  state: (): NotificationsState => ({ items: [], unread: 0, loaded: false }),

  actions: {
    async fetchAll(): Promise<void> {
      const { data } = await http.get<{ notifications: AppNotification[]; unread: number }>('/notifications')
      this.items = data.notifications ?? []
      this.unread = data.unread
      this.loaded = true
    },

    async refreshUnread(): Promise<void> {
      try {
        const { data } = await http.get<{ unread: number }>('/notifications/unread-count')
        // New ones arrived: the list is stale.
        if (data.unread !== this.unread) this.loaded = false
        this.unread = data.unread
      } catch {
        // Polling is best effort; the next tick tries again.
      }
    },

    async markRead(id: string): Promise<void> {
      const n = this.items.find((x) => x.id === id)
      if (!n || n.read) return
      n.read = true
      this.unread = Math.max(0, this.unread - 1)
      await http.post(`/notifications/${id}/read`)
    },

    async markAllRead(): Promise<void> {
      this.items.forEach((n) => (n.read = true))
      this.unread = 0
      await http.post('/notifications/read-all')
    },

    /** Polls the unread count, and refreshes it whenever the tab comes back into view. */
    startPolling(): void {
      if (timer !== undefined) return
      void this.refreshUnread()
      timer = window.setInterval(() => void this.refreshUnread(), POLL_MS)
      document.addEventListener('visibilitychange', this.onVisible)
    },

    stopPolling(): void {
      window.clearInterval(timer)
      timer = undefined
      document.removeEventListener('visibilitychange', this.onVisible)
    },

    onVisible(): void {
      if (document.visibilityState === 'visible') void useNotificationsStore().refreshUnread()
    },
  },
})
