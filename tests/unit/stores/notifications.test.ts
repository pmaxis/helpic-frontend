import { afterEach, describe, expect, it, vi } from 'vitest'
import { http } from '@/services/api'
import { useNotificationsStore } from '@/stores/notifications'
import type { AppNotification } from '@/types/notifications'

const note = (id: string, read = false) => ({ id, read }) as AppNotification

afterEach(() => {
  useNotificationsStore().stopPolling()
  vi.useRealTimers()
})

describe('notifications store', () => {
  it('loads the list with the unread count', async () => {
    const store = useNotificationsStore()
    vi.spyOn(http, 'get').mockResolvedValue({ data: { notifications: [note('a')], unread: 1 } })
    await store.fetchAll()
    expect([store.items.length, store.unread, store.loaded]).toEqual([1, 1, true])
  })

  it('marks the list stale when the unread count moved, and ignores a failed poll', async () => {
    const store = useNotificationsStore()
    store.loaded = true
    vi.spyOn(http, 'get').mockResolvedValueOnce({ data: { unread: 3 } })
    await store.refreshUnread()
    expect([store.unread, store.loaded]).toEqual([3, false])

    vi.spyOn(http, 'get').mockRejectedValueOnce(new Error('offline'))
    await store.refreshUnread()
    expect(store.unread).toBe(3)
  })

  it('marks one read once, and all read', async () => {
    const store = useNotificationsStore()
    store.items = [note('a'), note('b')]
    store.unread = 2
    const post = vi.spyOn(http, 'post').mockResolvedValue({ data: {} })
    await store.markRead('a')
    await store.markRead('a')
    expect(post).toHaveBeenCalledOnce()
    expect(store.unread).toBe(1)

    await store.markAllRead()
    expect(store.items.every((n) => n.read)).toBe(true)
    expect(store.unread).toBe(0)
  })

  it('polls while asked to, and when the tab comes back into view', async () => {
    vi.useFakeTimers()
    const store = useNotificationsStore()
    const get = vi.spyOn(http, 'get').mockResolvedValue({ data: { unread: 0 } })
    store.startPolling()
    store.startPolling()
    expect(get).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(30_000)
    expect(get).toHaveBeenCalledTimes(2)

    document.dispatchEvent(new Event('visibilitychange'))
    expect(get).toHaveBeenCalledTimes(3)

    store.stopPolling()
    await vi.advanceTimersByTimeAsync(60_000)
    document.dispatchEvent(new Event('visibilitychange'))
    expect(get).toHaveBeenCalledTimes(3)
  })
})
