import { describe, expect, it, vi } from 'vitest'
import TaskShareModal from '@/components/tasks/TaskShareModal.vue'
import { t } from '@/i18n'
import { useToasts } from '@/composables/useToasts'
import { api, render } from '../../../helpers'
import { $, button, click } from '../../../dom'
import { makeUser } from '../../../fixtures'

const share = { url: 'https://app.helpic.test/share/tok', created_at: '2030-01-10T09:00:00Z' }

describe('TaskShareModal', () => {
  it('creates a link and copies it, then turns it off', async () => {
    const writeText = vi.fn(() => Promise.resolve())
    Object.assign(navigator, { clipboard: { writeText } })
    const server = api({ 'GET /tasks/t-1/share': { share: null }, 'POST /tasks/t-1/share': { share } })
    await render(TaskShareModal, { props: { taskId: 't-1' }, user: makeUser() })
    expect($('[role="dialog"]')?.textContent).toContain(t('share.explain'))
    expect($('#task-share-url')).toBeNull()

    await click(button(t('share.turnOn')))
    expect(server.to('POST /tasks/t-1/share')).toHaveLength(1)
    expect(($('#task-share-url') as HTMLInputElement).value).toBe(share.url)
    expect(writeText).toHaveBeenCalledWith(share.url)
    expect(useToasts().toasts.map((x) => x.message)).toContain(t('share.copied'))

    await click(button(t('share.turnOff')))
    expect(server.to('DELETE /tasks/t-1/share')).toHaveLength(1)
    expect($('#task-share-url')).toBeNull()
    expect(button(t('share.turnOn'))).toBeTruthy()
  })

  it('shows a link the task already has, to copy again', async () => {
    const writeText = vi.fn(() => Promise.resolve())
    Object.assign(navigator, { clipboard: { writeText } })
    api({ 'GET /tasks/t-1/share': { share } })
    await render(TaskShareModal, { props: { taskId: 't-1' }, user: makeUser() })
    expect(($('#task-share-url') as HTMLInputElement).value).toBe(share.url)
    expect($('[role="dialog"]')?.textContent).toContain(t('share.since', { date: '10 Jan 2030' }))
    await click(button(t('share.copy')))
    expect(writeText).toHaveBeenCalledWith(share.url)
  })
})
