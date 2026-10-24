import { describe, expect, it, vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import TaskAttachments from '@/components/tasks/TaskAttachments.vue'
import { t } from '@/i18n'
import { useToasts } from '@/composables/useToasts'
import type { Attachment } from '@/types/attachments'
import { api, render, status } from '../../../helpers'
import { $, $$, button, click } from '../../../dom'
import { makeUser } from '../../../fixtures'

const me = makeUser()
const file = (over: Partial<Attachment> = {}): Attachment => ({
  id: 'f1',
  task_id: 't-1',
  file_name: 'brief.pdf',
  content_type: 'application/pdf',
  size_bytes: 2048,
  is_image: false,
  uploaded_by: { id: me.id, name: me.name, email: me.email },
  can_delete: true,
  created_at: '2030-01-10T09:00:00Z',
  ...over,
})

URL.createObjectURL = vi.fn(() => 'blob:preview')
URL.revokeObjectURL = vi.fn()

function mountFiles(list: Attachment[] = [file()], props = {}) {
  const server = api({ 'GET /attachments': { attachments: list, max_size_bytes: 1024 * 1024 }, 'GET /attachments/img': new Blob(['x']) })
  return { server, view: render(TaskAttachments, { props: { taskId: 't-1', ...props }, user: me }) }
}

/** Drops files on the section as a drag from the desktop would. */
function drop(target: Element, files: File[], kind = 'drop') {
  const e = new Event(kind, { bubbles: true, cancelable: true }) as DragEvent
  Object.defineProperty(e, 'dataTransfer', { value: { types: ['Files'], files, dropEffect: '' } })
  target.dispatchEvent(e)
  return e
}

describe('TaskAttachments', () => {
  it('lists the files with their type and size, previewing images', async () => {
    const { server, view } = mountFiles([file(), file({ id: 'img', file_name: 'mock.png', is_image: true, content_type: 'image/png' })])
    const files = await view
    expect(files.text()).toContain('brief.pdf')
    expect(files.text()).toContain('PDF')
    expect(files.text()).toContain('2 KB')
    expect(server.to('GET /attachments/img')[0].params).toEqual({ inline: 1 })
    expect($('img')?.getAttribute('src')).toBe('blob:preview')
  })

  it('uploads a picked file and adds it to the list', async () => {
    const { server, view } = mountFiles([])
    const files = await view
    server.reply('POST /attachments', { attachment: file({ id: 'new', file_name: 'spec.docx' }) })
    const input = files.get('input[type="file"]').element as HTMLInputElement
    Object.defineProperty(input, 'files', { value: [new File(['x'], 'spec.docx')], configurable: true })
    input.dispatchEvent(new Event('change'))
    await flushPromises()
    expect(server.to('POST /attachments')).toHaveLength(1)
    expect(files.text()).toContain('spec.docx')
    expect(files.text()).toContain('DOCX')
  })

  it('takes files dropped on it, refusing one too large', async () => {
    const { server, view } = mountFiles([])
    const files = await view
    server.reply('POST /attachments', { attachment: file({ id: 'ok', file_name: 'ok.txt' }) })
    const section = files.element as HTMLElement
    drop(section, [], 'dragenter')
    const over = drop(section, [], 'dragover')
    expect(over.defaultPrevented).toBe(true)
    await flushPromises()
    expect(files.text()).toContain(t('attachments.dropToAttach'))
    drop(section, [], 'dragleave')

    const big = new File(['x'], 'huge.mov')
    Object.defineProperty(big, 'size', { value: 50 * 1024 * 1024 })
    drop(section, [big, new File(['x'], 'ok.txt')])
    await flushPromises()
    expect(useToasts().toasts.some((x) => x.message.includes('huge.mov'))).toBe(true)
    expect(server.to('POST /attachments')).toHaveLength(1)
  })

  it('says why an upload failed', async () => {
    const { server, view } = mountFiles([])
    const files = await view
    server.reply('POST /attachments', status(415, { error: { code: 'TYPE', message: 'Not allowed' } }))
    drop(files.element, [new File(['x'], 'run.exe')])
    await flushPromises()
    expect(useToasts().toasts.at(-1)?.message).toContain('Not allowed')
  })

  it('opens a file in the viewer and goes through the task’s files', async () => {
    const { server, view } = mountFiles([file({ id: 'img', file_name: 'mock.png', is_image: true, content_type: 'image/png' }), file()])
    await view
    server.reply('GET /attachments/f1', new Blob(['%PDF']))
    await click(button(`${t('attachments.open')} mock.png`))
    const dialog = () => $('[role="dialog"]')!
    expect(dialog().getAttribute('aria-label')).toBe('mock.png')
    expect(dialog().querySelector('img[alt="mock.png"]')?.getAttribute('src')).toBe('blob:preview')
    expect(dialog().textContent).toContain(t('attachments.counter', { n: 1, total: 2 }))
    expect(server.to('GET /attachments/img')).toHaveLength(1)

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }))
    await flushPromises()
    expect(dialog().querySelector('iframe')?.getAttribute('src')).toBe('blob:preview')
    expect(dialog().textContent).toContain(t('attachments.counter', { n: 2, total: 2 }))

    await click(button(t('attachments.previous')))
    expect(dialog().querySelector('img[alt="mock.png"]')).not.toBeNull()
    await click(button('brief.pdf'))
    expect(dialog().querySelector('iframe')).not.toBeNull()
    expect(server.to('GET /attachments/f1')).toHaveLength(1)

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await flushPromises()
    expect($('[role="dialog"]')).toBeNull()
  })

  it('shows a text file’s contents, and a way to download one it can’t show', async () => {
    const { server, view } = mountFiles([file({ id: 'txt', file_name: 'notes.txt', content_type: 'text/plain' }), file({ id: 'zip', file_name: 'src.zip', content_type: 'application/zip' })])
    await view
    server.reply('GET /attachments/txt', new Blob(['line one\nline two']))
    await click(button(`${t('attachments.open')} notes.txt`))
    await vi.waitFor(() => expect($('[role="dialog"] pre')?.textContent).toBe('line one\nline two'))

    await click(button(t('attachments.next')))
    expect($('[role="dialog"]')!.textContent).toContain(t('attachments.noPreview'))
    expect(server.to('GET /attachments/zip')).toHaveLength(0)
    const click_ = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    server.reply('GET /attachments/zip', new Blob(['PK']))
    await click($$('[role="dialog"] button').find((b) => b.textContent?.includes(t('attachments.download')))!)
    expect(click_).toHaveBeenCalled()
  })

  it('says when a preview can’t load, offering the download', async () => {
    const { server, view } = mountFiles([file()])
    await view
    server.reply('GET /attachments/f1', status(500))
    await click(button(`${t('attachments.open')} brief.pdf`))
    expect($('[role="dialog"]')!.textContent).toContain(t('attachments.previewFailed'))
    expect($('[role="dialog"]')!.textContent).not.toContain(t('attachments.counter', { n: 1, total: 1 }))
  })

  it('downloads a file from the list', async () => {
    const { server, view } = mountFiles([file()])
    await view
    server.reply('GET /attachments/f1', new Blob(['%PDF']))
    const click_ = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    await click(button(t('attachments.downloadNamed', { name: 'brief.pdf' })))
    expect(click_).toHaveBeenCalled()
  })

  it('deletes your own file after asking', async () => {
    const { server, view } = mountFiles()
    const files = await view
    await click(button(t('attachments.deleteNamed', { name: 'brief.pdf' })))
    await click($$('[role="dialog"] button').find((b) => b.textContent?.includes(t('attachments.delete')))!)
    expect(server.to('DELETE /attachments/f1')).toHaveLength(1)
    expect(files.text()).not.toContain('brief.pdf')
  })

  it('takes nothing on an archived task', async () => {
    const { view } = mountFiles([], { readonly: true })
    const files = await view
    expect(files.text()).toContain(t('attachments.none'))
    expect(files.text()).not.toContain(t('attachments.add'))
    expect(drop(files.element, [], 'dragover').defaultPrevented).toBe(false)
  })

  it('says when the files can’t load', async () => {
    api({ 'GET /attachments': status(500) })
    await render(TaskAttachments, { props: { taskId: 't-1' }, user: me })
    expect(useToasts().toasts.at(-1)?.message).toBe(t('attachments.loadFailed'))
  })
})
