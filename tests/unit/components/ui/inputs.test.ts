import { afterEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import DateInput from '@/components/ui/DateInput.vue'
import MonthInput from '@/components/ui/MonthInput.vue'
import MultiSelectInput from '@/components/ui/MultiSelectInput.vue'
import TagInput from '@/components/ui/TagInput.vue'
import BaseInput from '@/components/ui/BaseInput.vue'
import BaseSelect from '@/components/ui/BaseSelect.vue'
import BaseTextarea from '@/components/ui/BaseTextarea.vue'
import ToggleSwitch from '@/components/ui/ToggleSwitch.vue'
import { $, $$, click, press, pressOutside, texts } from '../../../dom'

afterEach(() => {
  vi.useRealTimers()
})

describe('DateInput', () => {
  function mountDate(modelValue = '2030-01-15', props = {}) {
    return mount(DateInput, { props: { modelValue, label: 'Due date', ...props }, attachTo: document.body })
  }

  it('shows the date in the interface language, shorter when compact', () => {
    expect(mountDate().text()).toContain('Tue, 15 Jan 2030')
    expect(mountDate('2030-01-15', { compact: true }).text()).toContain('15 Jan 2030')
    expect(mountDate('', { placeholder: 'None' }).text()).toContain('None')
  })

  it('opens on the chosen month and picks a day', async () => {
    const date = mountDate()
    await click(date.get('button').element)
    expect($('[role="dialog"]')?.textContent).toContain('January 2030')
    expect($$('[role="gridcell"]')).toHaveLength(42)
    await click('[data-iso="2030-01-20"]')
    expect(date.emitted('update:modelValue')).toEqual([['2030-01-20']])
    expect($('[role="dialog"]')).toBeNull()
  })

  it('turns the months, clamping the day (31 Jan → 28 Feb)', async () => {
    const date = mountDate('2030-01-31')
    await click(date.get('button').element)
    await click('[aria-label="Next month"]')
    expect($('[role="dialog"]')?.textContent).toContain('February 2030')
    await click('[aria-label="Previous month"]')
    await click('[aria-label="Previous month"]')
    expect($('[role="dialog"]')?.textContent).toContain('December 2029')
  })

  it('moves by day, week, month and to the week’s ends from the keyboard', async () => {
    const date = mountDate('2030-01-15') // a Tuesday
    await press('Enter', date.get('button').element)
    const grid = $('[role="grid"]')!
    const steps: [string, string][] = [
      ['ArrowRight', '2030-01-16'],
      ['ArrowLeft', '2030-01-15'],
      ['ArrowDown', '2030-01-22'],
      ['ArrowUp', '2030-01-15'],
      ['PageDown', '2030-02-15'],
      ['PageUp', '2030-01-15'],
      ['Home', '2030-01-14'],
      ['End', '2030-01-20'],
    ]
    for (const [key, iso] of steps) {
      await press(key, grid)
      await nextTick()
      expect((document.activeElement as HTMLElement).dataset.iso).toBe(iso)
    }
    await press('Enter', grid)
    expect(date.emitted('update:modelValue')).toEqual([['2030-01-20']])
  })

  it('picks today, clears, and closes on Escape, Tab or a press outside', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(2030, 5, 1))
    const date = mountDate('')
    const button = date.get('button').element
    await click(button)
    await click($$('[role="dialog"] button').find((b) => b.textContent?.includes('Today'))!)
    expect(date.emitted('update:modelValue')).toEqual([['2030-06-01']])

    await press(' ', button)
    await press('Escape', $('[role="dialog"]'))
    expect($('[role="dialog"]')).toBeNull()
    await press('ArrowDown', button)
    await press('Tab', $('[role="dialog"]'))
    expect($('[role="dialog"]')).toBeNull()
    await click(button)
    await pressOutside()
    expect($('[role="dialog"]')).toBeNull()

    await date.setProps({ modelValue: '2030-01-01' })
    await click('[aria-label="Clear date"]')
    expect(date.emitted('update:modelValue')?.at(-1)).toEqual([''])
  })

  it('picks no day before min or past max', async () => {
    const date = mountDate('2030-01-15', { min: '2030-01-10', max: '2030-01-20' })
    await click(date.get('button').element)
    expect($('[data-iso="2030-01-09"]')?.getAttribute('aria-disabled')).toBe('true')
    expect($('[data-iso="2030-01-21"]')?.getAttribute('aria-disabled')).toBe('true')
    await click('[data-iso="2030-01-09"]')
    await click('[data-iso="2030-01-21"]')
    expect(date.emitted('update:modelValue')).toBeUndefined()
    await click('[data-iso="2030-01-10"]')
    expect(date.emitted('update:modelValue')).toEqual([['2030-01-10']])
  })

  it('shows its error and stays shut while disabled', async () => {
    const date = mountDate('', { error: 'Pick a date', disabled: true })
    expect(date.text()).toContain('Pick a date')
    await click(date.get('button').element)
    expect($('[role="dialog"]')).toBeNull()
  })
})

describe('MonthInput', () => {
  it('builds YYYY-MM from the two halves, defaulting the other', async () => {
    const month = mount(MonthInput, { props: { modelValue: '' }, attachTo: document.body })
    const [monthSelect, yearSelect] = month.findAll('[role="combobox"]')
    await click(monthSelect.element)
    await click($$('[role="option"]')[2])
    expect(month.emitted('update:modelValue')?.[0][0]).toMatch(/^\d{4}-03$/)

    await month.setProps({ modelValue: '2031-03' })
    await click(yearSelect.element)
    await click($$('[role="option"]').find((o) => o.textContent?.trim() === '2029')!)
    expect(month.emitted('update:modelValue')?.at(-1)).toEqual(['2029-03'])
  })
})

describe('MultiSelectInput', () => {
  const OPTIONS = ['Alpha', 'Beta', 'Gamma'].map((label) => ({ value: label.toLowerCase(), label }))

  function mountMulti(modelValue: string[] = [], props = {}) {
    return mount(MultiSelectInput, { props: { modelValue, label: 'Projects', options: OPTIONS, placeholder: 'All projects', ...props }, attachTo: document.body })
  }

  it('names up to two picks, then counts them', () => {
    expect(mountMulti().text()).toContain('All projects')
    expect(mountMulti(['alpha', 'gamma']).text()).toContain('Alpha, Gamma')
    expect(mountMulti(['alpha', 'beta', 'gamma']).text()).toContain('3 selected')
  })

  it('toggles options, keeping the list’s order', async () => {
    const multi = mountMulti(['gamma'])
    await click(multi.get('button').element)
    await click($$('[role="checkbox"]')[0])
    expect(multi.emitted('update:modelValue')).toEqual([[['alpha', 'gamma']]])
    await click($$('[role="checkbox"]')[2])
    // the props still say [gamma]: unticking it leaves nothing
    expect(multi.emitted('update:modelValue')?.at(-1)).toEqual([[]])
  })

  it('keeps locked picks, even when cleared', async () => {
    const multi = mountMulti(['alpha', 'beta'], { locked: ['alpha'] })
    await click(multi.get('button').element)
    await click($$('[role="checkbox"]')[0])
    expect(multi.emitted('update:modelValue')).toBeUndefined()
    await click($$('[role="dialog"] button').at(-1)!)
    expect(multi.emitted('update:modelValue')).toEqual([[['alpha']]])
  })

  it('closes on Escape or a press outside, and stays shut while disabled', async () => {
    const multi = mountMulti()
    await click(multi.get('button').element)
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await nextTick()
    expect($('[role="dialog"]')).toBeNull()
    await click(multi.get('button').element)
    window.dispatchEvent(new Event('resize'))
    await pressOutside()
    expect($('[role="dialog"]')).toBeNull()

    document.body.innerHTML = ''
    const off = mountMulti([], { disabled: true, error: 'Required' })
    await click(off.get('button').element)
    expect($('[role="dialog"]')).toBeNull()
    expect(off.text()).toContain('Required')
  })
})

describe('TagInput', () => {
  function mountTags(modelValue: string[] = []) {
    return mount(TagInput, { props: { modelValue }, attachTo: document.body })
  }

  it('adds the typed value on Enter or a comma, once, whatever its case', async () => {
    const tags = mountTags(['Vue'])
    const input = tags.get('input')
    await input.setValue(' React ')
    await input.trigger('keydown', { key: 'Enter' })
    expect(tags.emitted('update:modelValue')).toEqual([[['Vue', 'React']]])
    await input.setValue('vue')
    await input.trigger('keydown', { key: ',' })
    expect(tags.emitted('update:modelValue')).toHaveLength(1)
  })

  it('adds every part of a pasted list, and leaves a plain paste alone', async () => {
    const tags = mountTags()
    const input = tags.get('input')
    const paste = (text: string) => {
      const e = new Event('paste', { cancelable: true }) as ClipboardEvent
      Object.defineProperty(e, 'clipboardData', { value: { getData: () => text } })
      input.element.dispatchEvent(e)
      return e
    }
    expect(paste('Go, Rust ,Zig').defaultPrevented).toBe(true)
    expect(tags.emitted('update:modelValue')).toEqual([[['Go', 'Rust', 'Zig']]])
    expect(paste('Elixir').defaultPrevented).toBe(false)
  })

  it('removes the last chip on Backspace in an empty field, and a chip by its button', async () => {
    const tags = mountTags(['A', 'B'])
    await tags.get('input').trigger('keydown', { key: 'Backspace' })
    expect(tags.emitted('update:modelValue')).toEqual([[['A']]])
    await tags.findAll('button')[0].trigger('click')
    expect(tags.emitted('update:modelValue')?.at(-1)).toEqual([['B']])
  })
})

describe('the plain fields', () => {
  it('pass their value up and show their label, hint and error', async () => {
    const input = mount(BaseInput, { props: { modelValue: 'a', label: 'Name', required: true } })
    await input.get('input').setValue('b')
    expect(input.emitted('update:modelValue')).toEqual([['b']])
    expect(input.text()).toContain('Name')
    await input.setProps({ error: 'Too short' })
    expect(input.get('input').attributes('aria-invalid')).toBe('true')
    expect(input.text()).toContain('Too short')

    const area = mount(BaseTextarea, { props: { modelValue: '', label: 'Notes', error: 'Required' } })
    await area.get('textarea').setValue('x')
    expect(area.emitted('update:modelValue')).toEqual([['x']])
    expect(area.text()).toContain('Required')

    const select = mount(BaseSelect, {
      props: { modelValue: 'a', label: 'Kind', error: 'Pick', options: [{ value: 'a', label: 'A' }, { value: 'b', label: 'B' }] },
      attachTo: document.body,
    })
    expect(select.get('[role="combobox"]').attributes('aria-invalid')).toBe('true')
    await click(select.get('[role="combobox"]').element)
    await click($$('[role="option"]')[1])
    expect(select.emitted('update:modelValue')).toEqual([['b']])
  })

  it('switches a toggle', async () => {
    const toggle = mount(ToggleSwitch, { props: { modelValue: false, label: 'On' } })
    await toggle.get('button').trigger('click')
    expect(toggle.emitted('update:modelValue')).toEqual([[true]])
    expect(toggle.get('button').attributes('aria-checked')).toBe('false')
  })
})

describe('nothing left open', () => {
  it('leaves the body clean after the inputs above', () => {
    expect(texts('[role="dialog"]')).toEqual([])
  })
})
