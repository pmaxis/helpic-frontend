import { reactive } from 'vue'

export type ToastTone = 'info' | 'success' | 'error'

export interface Toast {
  id: number
  message: string
  tone: ToastTone
}

const toasts = reactive<Toast[]>([])
let nextId = 1

function push(message: string, tone: ToastTone = 'info', ttl = 4000): void {
  const id = nextId++
  toasts.push({ id, message, tone })
  if (ttl > 0) {
    window.setTimeout(() => dismiss(id), ttl)
  }
}

function dismiss(id: number): void {
  const i = toasts.findIndex((t) => t.id === id)
  if (i >= 0) toasts.splice(i, 1)
}

/**
 * Lightweight app-wide toast queue. `ToastHost.vue` renders `toasts`; any module
 * can call `toast.success(...)` / `toast.error(...)` / `toast.info(...)`.
 */
export const toast = {
  info: (m: string, ttl?: number) => push(m, 'info', ttl),
  success: (m: string, ttl?: number) => push(m, 'success', ttl),
  error: (m: string, ttl?: number) => push(m, 'error', ttl ?? 6000),
}

export function useToasts() {
  return { toasts, dismiss }
}
