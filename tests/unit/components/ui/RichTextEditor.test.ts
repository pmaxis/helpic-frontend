import { describe, expect, it } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import RichTextEditor from '@/components/ui/RichTextEditor.vue'
import { renderRichText } from '@/utils/richText'

function mountEditor(modelValue: string) {
  return mount(RichTextEditor, { props: { modelValue, id: 'box', label: 'Description' }, attachTo: document.body })
}

describe('RichTextEditor', () => {
  it('shows the Markdown formatted', async () => {
    const w = mountEditor('## Goal\n\n**bold** text\n\n- one\n- two')
    await flushPromises()
    const box = w.get('#box')
    expect(box.find('h2').text()).toBe('Goal')
    expect(box.find('strong').text()).toBe('bold')
    expect(box.findAll('li')).toHaveLength(2)
    w.unmount()
  })

  it('formats with the toolbar and gives Markdown back', async () => {
    const w = mountEditor('word')
    await flushPromises()
    const vm = w.vm as unknown as { focus: () => void }
    vm.focus()
    // select all, then bold
    const editorEl = w.get('#box').element as HTMLElement & { editor?: { commands: { selectAll: () => void } } }
    editorEl.editor?.commands.selectAll()
    await w.get('button[aria-label^="Bold"]').trigger('click')
    const emitted = w.emitted('update:modelValue')!
    expect(emitted.at(-1)).toEqual(['**word**'])
    w.unmount()
  })

  it('keeps the line breaks and lists of a plain-text description through an edit', async () => {
    const w = mountEditor('first\nsecond\n\n- a\n- b')
    await flushPromises()
    expect(w.get('#box').findAll('br')).toHaveLength(1)
    const el = w.get('#box').element as HTMLElement & { editor?: { commands: { insertContentAt: (pos: number, text: string) => void } } }
    el.editor?.commands.insertContentAt(1, '!')
    const md = (w.emitted('update:modelValue')!.at(-1) as string[])[0]
    expect(renderRichText(md)).toBe(renderRichText('!first\nsecond\n\n- a\n- b'))
    w.unmount()
  })

  it('takes a new value from outside', async () => {
    const w = mountEditor('one')
    await flushPromises()
    await w.setProps({ modelValue: '*two*' })
    expect(w.get('#box').find('em').text()).toBe('two')
    expect(w.emitted('update:modelValue')).toBeUndefined()
    w.unmount()
  })
})
