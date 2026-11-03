import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import RichTextEditor from '@/components/ui/RichTextEditor.vue'
import { renderRichText } from '@/utils/richText'
import { fetchPageTitle } from '@/services/linkPreview'

vi.mock('@/services/linkPreview', () => ({ fetchPageTitle: vi.fn() }))
const titleOf = vi.mocked(fetchPageTitle)
beforeEach(() => {
  titleOf.mockReset()
  titleOf.mockResolvedValue(null)
})

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

  describe('a link', () => {
    type Commands = { setTextSelection: (r: number | { from: number; to: number }) => void; selectAll: () => void }
    const commands = (w: ReturnType<typeof mountEditor>) => (w.get('#box').element as HTMLElement & { editor: { commands: Commands } }).editor.commands
    const last = (w: ReturnType<typeof mountEditor>) => (w.emitted('update:modelValue')!.at(-1) as string[])[0]
    const openForm = (w: ReturnType<typeof mountEditor>) => w.get('button[aria-label^="Link"]').trigger('click')

    it('puts the selected text on a link, the address made whole', async () => {
      const w = mountEditor('see **docs** here')
      await flushPromises()
      commands(w).setTextSelection({ from: 5, to: 9 })
      await openForm(w)
      expect((w.get('#box-link-text').element as HTMLInputElement).value).toBe('docs')
      expect(document.activeElement).toBe(w.get('#box-link').element)
      await w.get('#box-link').setValue('example.com/docs')
      await w.get('form').trigger('submit')
      expect(last(w)).toBe('see [**docs**](https://example.com/docs) here')
      expect(w.find('form').exists()).toBe(false)
      w.unmount()
    })

    it('goes in at the caret with a text of its own, opened with ⌘/Ctrl + K', async () => {
      const w = mountEditor('Design: ')
      await flushPromises()
      commands(w).setTextSelection(9)
      await w.get('#box').trigger('keydown', { key: 'k', ctrlKey: true })
      await w.get('#box-link-text').setValue('Figma')
      await w.get('#box-link').setValue('https://figma.com/file/1')
      await w.get('form').trigger('submit')
      expect(last(w)).toBe('Design: [Figma](https://figma.com/file/1)')
      w.unmount()
    })

    it('shows the address without a text', async () => {
      const w = mountEditor('')
      await flushPromises()
      await openForm(w)
      await w.get('#box-link').setValue('https://example.com')
      await w.get('form').trigger('submit')
      expect(last(w)).toMatch(/^\[https:\/\/example\.com\]\(https:\/\/example\.com\)$|^<https:\/\/example\.com>$/)
      w.unmount()
    })

    it('edits a link the caret is in: its text, or takes it off', async () => {
      const w = mountEditor('go to [the site](https://old.io) now')
      await flushPromises()
      commands(w).setTextSelection(10)
      await openForm(w)
      expect((w.get('#box-link-text').element as HTMLInputElement).value).toBe('the site')
      expect((w.get('#box-link').element as HTMLInputElement).value).toBe('https://old.io')
      expect(w.get('a[aria-label^="Open"]').attributes('href')).toBe('https://old.io')
      await w.get('#box-link-text').setValue('the new site')
      await w.get('#box-link').setValue('https://new.io')
      await w.get('form').trigger('submit')
      expect(last(w)).toBe('go to [the new site](https://new.io) now')

      commands(w).setTextSelection(10)
      await openForm(w)
      await w.findAll('form button').find((b) => b.text() === 'Remove link')!.trigger('click')
      expect(last(w)).toBe('go to the new site now')
      w.unmount()
    })

    it('closes on Esc, leaving the text as it was', async () => {
      const w = mountEditor('word')
      await flushPromises()
      commands(w).selectAll()
      await openForm(w)
      await w.get('#box-link').setValue('https://x.io')
      await w.get('form').trigger('keydown', { key: 'Escape' })
      expect(w.find('form').exists()).toBe(false)
      expect(w.emitted('update:modelValue')).toBeUndefined()
      expect(w.emitted('cancel')).toBeUndefined()
      w.unmount()
    })
  })

  describe('a link named after its page', () => {
    type Commands = { setTextSelection: (r: number | { from: number; to: number }) => void; insertContent: (c: string) => void }
    const commands = (w: ReturnType<typeof mountEditor>) => (w.get('#box').element as HTMLElement & { editor: { commands: Commands } }).editor.commands
    const last = (w: ReturnType<typeof mountEditor>) => (w.emitted('update:modelValue')!.at(-1) as string[])[0]
    const paste = (w: ReturnType<typeof mountEditor>, text: string) => {
      const e = new Event('paste', { bubbles: true, cancelable: true }) as ClipboardEvent
      Object.defineProperty(e, 'clipboardData', { value: { getData: (type: string) => (type === 'text/plain' ? text : ''), types: ['text/plain'] } })
      w.get('#box').element.dispatchEvent(e)
    }

    it('fills the text with the page title as the address is typed', async () => {
      vi.useFakeTimers()
      titleOf.mockResolvedValue('Design — Figma')
      const w = mountEditor('See ')
      await flushPromises()
      commands(w).setTextSelection(5)
      await w.get('button[aria-label^="Link"]').trigger('click')
      await w.get('#box-link').setValue('figma.com/file/1')
      await vi.advanceTimersByTimeAsync(400)
      expect(titleOf).toHaveBeenCalledWith('https://figma.com/file/1')
      expect((w.get('#box-link-text').element as HTMLInputElement).value).toBe('Design — Figma')
      await w.get('form').trigger('submit')
      expect(last(w)).toBe('See [Design — Figma](https://figma.com/file/1)')
      vi.useRealTimers()
      w.unmount()
    })

    it("doesn't replace a text of the writer's own", async () => {
      vi.useFakeTimers()
      titleOf.mockResolvedValue('Page title')
      const w = mountEditor('')
      await flushPromises()
      await w.get('button[aria-label^="Link"]').trigger('click')
      await w.get('#box-link-text').setValue('My name')
      await w.get('#box-link').setValue('https://x.io')
      await vi.advanceTimersByTimeAsync(400)
      expect((w.get('#box-link-text').element as HTMLInputElement).value).toBe('My name')
      vi.useRealTimers()
      w.unmount()
    })

    it('names a link applied without a text once the title comes', async () => {
      let resolve!: (t: string | null) => void
      titleOf.mockReturnValue(new Promise((r) => (resolve = r)))
      const w = mountEditor('')
      await flushPromises()
      await w.get('button[aria-label^="Link"]').trigger('click')
      await w.get('#box-link').setValue('https://x.io/a')
      await w.get('form').trigger('submit')
      expect(last(w)).toMatch(/https:\/\/x\.io\/a/)
      resolve('The A page')
      await flushPromises()
      expect(last(w)).toBe('[The A page](https://x.io/a)')
      w.unmount()
    })

    it('turns a pasted address into a link named after the page', async () => {
      titleOf.mockResolvedValue('Docs')
      const w = mountEditor('Read ')
      await flushPromises()
      commands(w).setTextSelection(6)
      paste(w, 'https://docs.example.com/start')
      await flushPromises()
      expect(titleOf).toHaveBeenCalledWith('https://docs.example.com/start')
      expect(last(w)).toBe('Read [Docs](https://docs.example.com/start)')
      w.unmount()
    })

    it('keeps the address when the page has no title, and plain text pastes as it is', async () => {
      const w = mountEditor('')
      await flushPromises()
      paste(w, 'https://none.example.com')
      await flushPromises()
      expect(w.get('#box a').attributes('href')).toBe('https://none.example.com')
      expect(w.get('#box a').text()).toBe('https://none.example.com')
      w.unmount()
    })

    it('leaves a link whose text was changed meanwhile', async () => {
      let resolve!: (t: string | null) => void
      titleOf.mockReturnValue(new Promise((r) => (resolve = r)))
      const w = mountEditor('')
      await flushPromises()
      paste(w, 'https://x.io')
      await flushPromises()
      commands(w).setTextSelection(3)
      commands(w).insertContent('Z')
      resolve('Title')
      await flushPromises()
      expect(last(w)).not.toContain('Title')
      w.unmount()
    })
  })
})
