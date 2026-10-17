import { ref, watch, type Ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'

/**
 * A page's view choice (list / board, cards / list…). It lives in the URL
 * (?view=…) and is remembered per browser under `key`, so the last choice
 * opens next time.
 */
export function useViewMode<T extends string>(key: string, values: readonly T[], fallback: T): Ref<T> {
  const route = useRoute()
  const router = useRouter()

  function remembered(): T {
    try {
      const v = localStorage.getItem(key)
      return values.includes(v as T) ? (v as T) : fallback
    } catch {
      return fallback
    }
  }

  const fromUrl = route.query.view
  const view = ref(values.includes(fromUrl as T) ? (fromUrl as T) : remembered()) as Ref<T>

  watch(
    view,
    (v) => {
      try {
        localStorage.setItem(key, v)
      } catch {
        // storage may be unavailable (private mode); the URL still carries it
      }
      if (route.query.view !== v) void router.replace({ query: { ...route.query, view: v } })
    },
    { immediate: true },
  )

  return view
}
