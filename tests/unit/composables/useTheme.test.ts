import { afterEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'

afterEach(() => {
  vi.resetModules()
  document.documentElement.classList.remove('dark')
})

/** A fresh copy of the module, as on a page load, with the system dark or not. */
async function load(systemDark: boolean) {
  const listeners: (() => void)[] = []
  const media = { matches: systemDark, addEventListener: (_: string, fn: () => void) => listeners.push(fn) }
  vi.spyOn(window, 'matchMedia').mockReturnValue(media as never)
  const mod = await import('@/composables/useTheme')
  return { ...mod, media, systemChanged: () => listeners.forEach((fn) => fn()) }
}

describe('useTheme', () => {
  it('follows the system until a theme is picked', async () => {
    const { initTheme, useTheme, media, systemChanged } = await load(true)
    initTheme()
    expect(useTheme().theme.value).toBe('system')
    expect(document.documentElement.classList.contains('dark')).toBe(true)

    media.matches = false
    systemChanged()
    expect(document.documentElement.classList.contains('dark')).toBe(false)
  })

  it('applies a picked theme and remembers it', async () => {
    const { initTheme, useTheme } = await load(false)
    initTheme()
    useTheme().theme.value = 'dark'
    await nextTick()
    expect(document.documentElement.classList.contains('dark')).toBe(true)
    expect(localStorage.getItem('helpic:theme')).toBe('dark')
  })

  it('starts in the remembered theme, ignoring nonsense', async () => {
    localStorage.setItem('helpic:theme', 'light')
    expect((await load(true)).useTheme().theme.value).toBe('light')
    vi.resetModules()
    localStorage.setItem('helpic:theme', 'sepia')
    const { useTheme } = await load(true)
    expect(useTheme().theme.value).toBe('system')
    expect(useTheme().isTheme('dark')).toBe(true)
  })
})
