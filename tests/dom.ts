/** Small DOM helpers for what a component teleports to <body> or puts outside its own root. */
import { nextTick } from 'vue'
import { flushPromises } from '@vue/test-utils'

export function $(selector: string): HTMLElement | null {
  return document.body.querySelector<HTMLElement>(selector)
}

export function $$(selector: string): HTMLElement[] {
  return [...document.body.querySelectorAll<HTMLElement>(selector)]
}

/** Clicks an element and waits for Vue and the promises it started. */
export async function click(target: string | Element | null) {
  const el = typeof target === 'string' ? $(target) : target
  if (!el) throw new Error(`nothing to click: ${String(target)}`)
  ;(el as HTMLElement).click()
  await nextTick()
  await flushPromises()
}

/** Presses a key on an element (the focused one by default). */
export async function press(key: string, target: Element | null = document.activeElement, init: KeyboardEventInit = {}) {
  target?.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init }))
  await nextTick()
}

/** A pointer press outside every component. */
export async function pressOutside() {
  document.body.dispatchEvent(new Event('pointerdown', { bubbles: true }))
  await nextTick()
}

/** The text of each element matching selector. */
export function texts(selector: string): string[] {
  return $$(selector).map((el) => el.textContent?.trim() ?? '')
}

/** The first element matching selector whose text contains text. */
export function byText(selector: string, text: string): HTMLElement {
  const el = $$(selector).find((e) => e.textContent?.includes(text))
  if (!el) throw new Error(`no ${selector} with “${text}”; there are: ${texts(selector).join(' | ')}`)
  return el
}

/** The button whose text, aria-label or title contains text. */
export function button(text: string): HTMLButtonElement {
  const el = $$('button').find((b) => [b.textContent, b.getAttribute('aria-label'), b.getAttribute('title')].some((s) => s?.includes(text)))
  if (!el) throw new Error(`no button “${text}”; there are: ${$$('button').map((b) => b.textContent?.trim() || b.getAttribute('aria-label')).join(' | ')}`)
  return el as HTMLButtonElement
}

/** The field a <label> with this text points at, or the one with this aria-label. */
export function field<T extends HTMLElement = HTMLInputElement>(label: string): T {
  const byLabel = $$('label').find((l) => l.textContent?.trim().replace(/\s*\*.*$/, '') === label || l.textContent?.includes(label))
  const target = byLabel?.getAttribute('for') ? document.getElementById(byLabel.getAttribute('for')!) : null
  // a field, not a button that happens to share its name
  const el = target ?? $(`input[aria-label="${label}"], textarea[aria-label="${label}"], [role="combobox"][aria-label="${label}"]`) ?? $(`[aria-label="${label}"]`)
  if (!el) throw new Error(`no field “${label}”`)
  return el as T
}

/** Types into a field as a user would: sets its value and fires input. */
export async function type(el: HTMLInputElement | HTMLTextAreaElement, value: string) {
  el.value = value
  el.dispatchEvent(new Event('input', { bubbles: true }))
  el.dispatchEvent(new Event('change', { bubbles: true }))
  await nextTick()
}

/** Opens the select a label names and picks the option with this text. */
export async function choose(label: string, option: string) {
  await click(field<HTMLButtonElement>(label))
  await click(byText('[role="option"]', option))
}

/** A drag event as the browser sends it, with a dataTransfer and a pointer position. */
export function drag(target: Element, kind: string, { x = 0, y = 0, related = null as Node | null, types = ['text/plain'] } = {}) {
  const e = new Event(kind, { bubbles: true, cancelable: true })
  const data: Record<string, string> = {}
  Object.assign(e, { clientX: x, clientY: y, relatedTarget: related })
  Object.defineProperty(e, 'dataTransfer', {
    value: { types, setData: (k: string, v: string) => (data[k] = v), getData: (k: string) => data[k], effectAllowed: '', dropEffect: '' },
  })
  target.dispatchEvent(e)
  return e
}

/** Gives an element a box on screen, which jsdom never lays out. */
export function place(el: Element, box: { top?: number; left?: number; width?: number; height?: number }) {
  const { top = 0, left = 0, width = 100, height = 100 } = box
  el.getBoundingClientRect = () => ({ top, left, width, height, right: left + width, bottom: top + height, x: left, y: top, toJSON: () => ({}) })
}
