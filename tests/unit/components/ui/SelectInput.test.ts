import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import SelectInput from '@/components/ui/SelectInput.vue'
import { $, $$, click, press, pressOutside, texts } from '../../../dom'

const FRUIT = ['Apple', 'Banana', 'Cherry', 'Date'].map((label) => ({ value: label.toLowerCase(), label }))

function mountSelect(props: Partial<InstanceType<typeof SelectInput>['$props']> = {}) {
  return mount(SelectInput, { props: { modelValue: 'banana', options: FRUIT, 'aria-label': 'Fruit', ...props }, attachTo: document.body })
}

const trigger = () => $('[role="combobox"]')!

describe('SelectInput', () => {
  it('shows the picked option, or the placeholder while nothing is', () => {
    expect(mountSelect().text()).toContain('Banana')
    expect(mountSelect({ modelValue: '', placeholder: 'Pick one' }).text()).toContain('Pick one')
  })

  it('opens a list with the picked option highlighted, and picks on a click', async () => {
    const select = mountSelect()
    await click(trigger())
    expect(trigger().getAttribute('aria-expanded')).toBe('true')
    expect(texts('[role="option"]')).toEqual(['Apple', 'Banana', 'Cherry', 'Date'])
    expect($('[aria-selected="true"]')?.textContent?.trim()).toBe('Banana')

    await click($$('[role="option"]')[2])
    expect(select.emitted('update:modelValue')).toEqual([['cherry']])
    expect(select.emitted('change')).toEqual([['cherry']])
    expect($('[role="listbox"]')).toBeNull()
  })

  it('emits nothing for the option already picked', async () => {
    const select = mountSelect()
    await click(trigger())
    await click($$('[role="option"]')[1])
    expect(select.emitted('update:modelValue')).toBeUndefined()
  })

  it('moves with the arrows, Home and End, and picks with Enter', async () => {
    const select = mountSelect()
    trigger().focus()
    await press('ArrowDown', trigger())
    await nextTick()
    await press('ArrowDown', trigger())
    await press('End', trigger())
    await press('ArrowUp', trigger())
    await press('Home', trigger())
    await press('ArrowDown', trigger())
    await press('ArrowDown', trigger())
    expect($('[role="combobox"]')?.getAttribute('aria-activedescendant')).toMatch(/opt-2$/)
    await press('Enter', trigger())
    expect(select.emitted('update:modelValue')).toEqual([['cherry']])
  })

  it('picks with Space, closes with Escape and Tab without picking', async () => {
    const select = mountSelect()
    await press(' ', trigger())
    await press('ArrowDown', trigger())
    await press(' ', trigger())
    expect(select.emitted('update:modelValue')).toEqual([['cherry']])

    await press('Enter', trigger())
    await press('Escape', trigger())
    expect($('[role="listbox"]')).toBeNull()
    await press('ArrowUp', trigger())
    await press('Tab', trigger())
    expect($('[role="listbox"]')).toBeNull()
    expect(select.emitted('update:modelValue')).toHaveLength(1)
  })

  it('jumps by the first letters typed: closed it picks, open it highlights', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    const select = mountSelect()
    await press('d', trigger())
    expect(select.emitted('update:modelValue')).toEqual([['date']])
    vi.advanceTimersByTime(600)
    await press('Enter', trigger())
    await press('a', trigger())
    await press('Enter', trigger())
    expect(select.emitted('update:modelValue')?.at(-1)).toEqual(['apple'])
    vi.useRealTimers()
  })

  it('filters a long list as you type, saying when nothing matches', async () => {
    const many = Array.from({ length: 12 }, (_, i) => ({ value: `v${i}`, label: `Option ${i}` }))
    mountSelect({ options: many, modelValue: 'v0' })
    await click(trigger())
    const search = $('[role="searchbox"]') as HTMLInputElement
    search.value = 'option 1'
    search.dispatchEvent(new Event('input'))
    await nextTick()
    expect(texts('[role="option"]')).toEqual(['Option 1', 'Option 10', 'Option 11'])
    search.value = 'zzz'
    search.dispatchEvent(new Event('input'))
    await nextTick()
    expect($$('[role="option"]')).toHaveLength(0)
    await press(' ', search)
    expect($('[role="listbox"]')).not.toBeNull()
  })

  it('closes on a press outside, and stays shut while disabled', async () => {
    mountSelect()
    await click(trigger())
    await pressOutside()
    expect($('[role="listbox"]')).toBeNull()

    document.body.innerHTML = ''
    mountSelect({ disabled: true })
    await click(trigger())
    expect($('[role="listbox"]')).toBeNull()
  })

  it('follows the page as it scrolls and resizes while open, and flips up near the bottom', async () => {
    mountSelect()
    trigger().getBoundingClientRect = () => ({ top: 725, bottom: 765, left: 10, width: 200, height: 40, right: 210, x: 10, y: 700, toJSON: () => ({}) })
    Object.defineProperty(window, 'innerHeight', { value: 768, configurable: true })
    await click(trigger())
    window.dispatchEvent(new Event('resize'))
    document.dispatchEvent(new Event('scroll'))
    await nextTick()
    expect(($('[role="listbox"]')!.parentElement as HTMLElement).style.bottom).toBe('49px')
  })
})
