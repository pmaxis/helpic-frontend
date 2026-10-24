import { ref, watch, type Ref } from 'vue'

/** An on/off choice remembered in this browser under `key`. */
export function useStoredFlag(key: string): Ref<boolean> {
  function read(): boolean {
    try {
      return localStorage.getItem(key) === '1'
    } catch {
      return false
    }
  }

  const flag = ref(read())
  watch(flag, (on) => {
    try {
      localStorage.setItem(key, on ? '1' : '0')
    } catch {
      // storage may be unavailable (private mode); the choice then lasts for this visit
    }
  })
  return flag
}
