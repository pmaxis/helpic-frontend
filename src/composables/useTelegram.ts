/**
 * The user's Telegram connection, as the settings show it: loaded once, and
 * connected with a one-time link to the bot. While the link is open in
 * Telegram it checks every few seconds (and when the tab regains focus)
 * whether the chat got connected. Also picks which kinds go to the chat, and
 * disconnects it.
 */
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { ApiRequestError } from '@/services/api'
import { createTelegramLink, disconnectTelegram, fetchTelegram, setTelegramKinds } from '@/services/telegram'
import { toast } from '@/composables/useToasts'
import { t } from '@/i18n'
import type { NotificationKind } from '@/types/notifications'
import type { TelegramLink, TelegramStatus } from '@/types/telegram'

const POLL_MS = 2500

export function useTelegram() {
  const status = ref<TelegramStatus | null>(null)
  const loadFailed = ref(false)

  onMounted(async () => {
    try {
      status.value = await fetchTelegram()
    } catch {
      loadFailed.value = true
    }
  })

  // --- connecting -----------------------------------------------------------------

  const connecting = ref(false)
  /** The link waiting to be opened in Telegram. */
  const pending = ref<TelegramLink | null>(null)
  let timer: number | undefined

  async function connect() {
    connecting.value = true
    // Opened now, while the click still counts, or the browser blocks it.
    const win = window.open('', '_blank')
    try {
      const link = await createTelegramLink()
      pending.value = link
      if (win) {
        win.opener = null
        win.location.href = link.url
      }
      startWaiting()
    } catch (error) {
      win?.close()
      toast.error(error instanceof ApiRequestError ? error.message : t('notificationSettings.telegram.connectFailed'))
    } finally {
      connecting.value = false
    }
  }

  function startWaiting() {
    stopWaiting()
    timer = window.setInterval(() => void check(), POLL_MS)
    window.addEventListener('focus', check)
  }

  function stopWaiting() {
    window.clearInterval(timer)
    window.removeEventListener('focus', check)
  }

  function cancelWaiting() {
    pending.value = null
    stopWaiting()
  }

  async function check() {
    if (!pending.value) return
    if (new Date(pending.value.expires_at).getTime() < Date.now()) {
      cancelWaiting()
      toast.info(t('notificationSettings.telegram.expired'))
      return
    }
    try {
      const s = await fetchTelegram()
      if (s.connected) {
        status.value = s
        cancelWaiting()
        toast.success(t('notificationSettings.telegram.connectedToast'))
      }
    } catch {
      // Try again on the next tick.
    }
  }

  onBeforeUnmount(stopWaiting)

  // --- what goes there ----------------------------------------------------------------

  /** Saves run one after another, so quick toggles land in order. */
  let saving = Promise.resolve()

  function toggle(kind: NotificationKind, on: boolean) {
    const kinds = status.value?.kinds ?? []
    setKinds(on ? [...kinds, kind] : kinds.filter((k) => k !== kind))
  }

  /** Sends exactly these kinds to the chat; none sends nothing. */
  function setKinds(next: NotificationKind[]) {
    const s = status.value
    if (!s) return
    const previous = s.kinds
    s.kinds = next
    saving = saving.then(async () => {
      try {
        status.value = await setTelegramKinds(next)
      } catch (error) {
        s.kinds = previous
        toast.error(error instanceof ApiRequestError ? error.message : t('notificationSettings.saveFailed'))
      }
    })
  }

  // --- disconnecting ------------------------------------------------------------------

  const disconnecting = ref(false)

  async function disconnect() {
    disconnecting.value = true
    try {
      await disconnectTelegram()
      status.value = await fetchTelegram()
      toast.success(t('notificationSettings.telegram.disconnected'))
    } catch (error) {
      toast.error(error instanceof ApiRequestError ? error.message : t('notificationSettings.telegram.disconnectFailed'))
    } finally {
      disconnecting.value = false
    }
  }

  return { status, loadFailed, connecting, pending, connect, cancelWaiting, toggle, setKinds, disconnecting, disconnect }
}
