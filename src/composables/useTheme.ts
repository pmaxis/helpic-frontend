/**
 * Light, dark, or whatever the system uses — kept on this device. public/theme.js
 * puts it on before the app loads; this follows changes from Settings and,
 * on "system", from the OS.
 */
import { ref, watch } from 'vue'

export const THEMES = ['system', 'light', 'dark'] as const
export type Theme = (typeof THEMES)[number]

const STORAGE_KEY = 'helpic:theme'

function isTheme(value: unknown): value is Theme {
  return THEMES.includes(value as Theme)
}

function stored(): Theme {
  try {
    const value = localStorage.getItem(STORAGE_KEY)
    if (isTheme(value)) return value
  } catch {
    // storage may be unavailable (private mode)
  }
  return 'system'
}

const theme = ref<Theme>(stored())
const systemDark = window.matchMedia('(prefers-color-scheme: dark)')

function apply() {
  const dark = theme.value === 'dark' || (theme.value === 'system' && systemDark.matches)
  document.documentElement.classList.toggle('dark', dark)
}

/** Starts following the picked theme and the system's. Called once, from main.ts. */
export function initTheme() {
  apply()
  systemDark.addEventListener('change', apply)
  watch(theme, (value) => {
    try {
      localStorage.setItem(STORAGE_KEY, value)
    } catch {
      // storage may be unavailable (private mode)
    }
    apply()
  })
}

export function useTheme() {
  return { theme, isTheme }
}
