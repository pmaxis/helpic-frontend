import { afterEach, beforeEach } from 'vitest'
import { config, enableAutoUnmount } from '@vue/test-utils'
import { http } from '@/services/api'
import { createPinia, setActivePinia } from 'pinia'
import { i18n, setLocale } from '@/i18n'

// jsdom has no matchMedia; the theme asks it whether the system is dark. It isn't, here.
window.matchMedia ??= (query: string) =>
  ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  }) as MediaQueryList

// …nor scrolling an element into view, which every browser does.
Element.prototype.scrollIntoView ??= () => {}
Element.prototype.scrollTo ??= () => {}

// …nor ResizeObserver: nothing is laid out, so nothing ever resizes.
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
}

// Components get $t as in the app; each test starts in English with fresh stores and storage.
config.global.plugins = [i18n]

// The real adapter, put back after a test served the API itself; mounted components are unmounted.
const adapter = http.defaults.adapter
enableAutoUnmount(afterEach)
afterEach(() => {
  http.defaults.adapter = adapter
  document.body.innerHTML = ''
})

beforeEach(() => {
  localStorage.clear()
  setLocale('en')
  setActivePinia(createPinia())
})
