import { describe, expect, it } from 'vitest'
import LabelPicker from '@/components/tasks/LabelPicker.vue'
import { t } from '@/i18n'
import { useToasts } from '@/composables/useToasts'
import type { BoardLabel } from '@/types/board'
import { api, render, status } from '../../../helpers'
import { $, $$, button, click, press, pressOutside, type } from '../../../dom'

const label = (id: string, name: string, task_count = 1): BoardLabel => ({ id, name, color: 'red', task_count })
const LABELS = [label('bug', 'Bug'), label('ui', 'UI', 3)]

async function openPicker(modelValue: string[] = ['bug'], labels = LABELS) {
  const server = api({ 'GET /board/labels': { labels } })
  const picker = await render(LabelPicker, { props: { modelValue, scope: { with: 'c1' } } })
  await click(picker.get('button').element)
  return { server, picker }
}

const search = () => $(`[aria-label="${t('labels.findOrCreateAria')}"]`) as HTMLInputElement

describe('LabelPicker', () => {
  it('lists the board’s labels, the task’s ticked, and toggles one on a click', async () => {
    const { server, picker } = await openPicker()
    expect(server.to('GET /board/labels')[0].params).toEqual({ with: 'c1' })
    const boxes = $$('[role="checkbox"]')
    expect(boxes.map((b) => b.getAttribute('aria-checked'))).toEqual(['true', 'false'])
    await click(boxes[1])
    await click(boxes[0])
    expect(picker.emitted('update:modelValue')).toEqual([[['bug', 'ui']], [[]]])
  })

  it('finds a label as you type, Enter picking the only match', async () => {
    const { picker } = await openPicker([])
    await type(search(), 'u')
    expect($$('[role="checkbox"]')).toHaveLength(2)
    await type(search(), 'ui')
    await press('Enter', search())
    expect(picker.emitted('update:modelValue')).toEqual([[['ui']]])
  })

  it('creates the typed label and puts it on the task', async () => {
    const { server, picker } = await openPicker(['bug'])
    server.reply('POST /board/labels', { label: label('copy', 'Copy') })
    await type(search(), 'Copy')
    await press('Enter', search())
    await new Promise((r) => setTimeout(r))
    expect(server.to('POST /board/labels')[0].body).toMatchObject({ with: 'c1', name: 'Copy' })
    expect(picker.emitted('update:modelValue')).toEqual([[['bug', 'copy']]])
    expect(search().value).toBe('')
  })

  it('offers no create for a name already taken, and says when creating fails', async () => {
    const { server } = await openPicker()
    await type(search(), 'bug')
    expect(() => button(t('labels.create', { name: 'bug' }))).toThrow()
    server.reply('POST /board/labels', status(422, { error: { code: 'V', message: 'x', fields: { name: 'Too long' } } }))
    await type(search(), 'New one')
    await click(button(t('labels.create', { name: 'New one' })))
    expect(useToasts().toasts.at(-1)?.message).toBe('Too long')
  })

  it('renames, recolours and deletes a label, telling the task to reload', async () => {
    const { server, picker } = await openPicker()
    server.reply('PUT /board/labels/ui', { label: { ...label('ui', 'Design'), color: 'blue' } })
    await click(button(t('labels.editNamed', { name: 'UI' })))
    const name = document.getElementById('label-edit-ui') as HTMLInputElement
    await type(name, 'Design')
    await click($$('[role="radio"]')[6])
    await press('Enter', name)
    await new Promise((r) => setTimeout(r))
    expect(server.to('PUT /board/labels/ui')[0].body).toMatchObject({ name: 'Design' })
    expect(picker.emitted('labels-changed')).toHaveLength(1)

    await click(button(t('labels.editNamed', { name: 'Design' })))
    await click(button(t('labels.delete')))
    expect(server.to('DELETE /board/labels/ui')).toHaveLength(1)
    expect(picker.emitted('labels-changed')).toHaveLength(2)
    expect($$('[role="checkbox"]')).toHaveLength(1)
  })

  it('closes an edit on Escape, then the picker; and on a press outside', async () => {
    const { picker } = await openPicker()
    await click(button(t('labels.editNamed', { name: 'Bug' })))
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await picker.vm.$nextTick()
    expect(document.getElementById('label-edit-bug')).toBeNull()
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await picker.vm.$nextTick()
    expect($('[role="dialog"]')).toBeNull()

    await click(picker.get('button').element)
    window.dispatchEvent(new Event('resize'))
    await pressOutside()
    expect($('[role="dialog"]')).toBeNull()
  })

  it('stays shut while disabled, and says when the labels can’t load', async () => {
    api({ 'GET /board/labels': status(500) })
    const picker = await render(LabelPicker, { props: { modelValue: [], scope: {}, disabled: true } })
    await click(picker.get('button').element)
    expect($('[role="dialog"]')).toBeNull()
    await picker.setProps({ disabled: false })
    await click(picker.get('button').element)
    expect(useToasts().toasts.at(-1)?.message).toBe(t('labels.loadFailed'))
  })
})
