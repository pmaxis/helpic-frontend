import { describe, expect, it } from 'vitest'
import TaskComments from '@/components/tasks/TaskComments.vue'
import { t } from '@/i18n'
import { useToasts } from '@/composables/useToasts'
import type { Comment } from '@/types/comments'
import { api, render, status } from '../../../helpers'
import { button, click, press, type } from '../../../dom'
import { makeUser } from '../../../fixtures'

const me = makeUser()
const comment = (over: Partial<Comment> = {}): Comment => ({
  id: 'c1',
  task_id: 't-1',
  author: { id: me.id, name: me.name, email: me.email },
  body: 'Looks good',
  edited: false,
  can_edit: true,
  created_at: '2030-01-10T09:00:00Z',
  updated_at: '2030-01-10T09:00:00Z',
  ...over,
})

function mountComments(list: Comment[] = [comment()], props = {}) {
  const server = api({ 'GET /comments': { comments: list } })
  return { server, comments: render(TaskComments, { props: { taskId: 't-1', ...props }, user: me }) }
}

describe('TaskComments', () => {
  it('lists the discussion with “You” for your own, and says when there is none', async () => {
    const { comments } = mountComments([comment(), comment({ id: 'c2', author: { id: 'x', name: 'Acme', email: 'a@b.c' }, can_edit: false, edited: true })])
    const view = await comments
    expect(view.text()).toContain(t('common.you_capital'))
    expect(view.text()).toContain('Acme')
    expect(view.emitted('count')?.at(-1)).toEqual([2])

    const { comments: empty } = mountComments([])
    expect((await empty).text()).toContain(t('comments.empty'))
  })

  it('sends a comment with ⌘/Ctrl + Enter and adds it to the end', async () => {
    const { server, comments } = mountComments([])
    const view = await comments
    server.reply('POST /comments', { comment: comment({ id: 'new', body: 'Hello' }) })
    const box = view.get('textarea').element as HTMLTextAreaElement
    await type(box, '   ')
    await press('Enter', box, { ctrlKey: true })
    expect(server.to('POST /comments')).toHaveLength(0)

    await type(box, 'Hello')
    await press('Enter', box, { metaKey: true })
    await new Promise((r) => setTimeout(r))
    expect(server.to('POST /comments')[0]).toMatchObject({ body: { body: 'Hello' }, params: { task: 't-1' } })
    expect(view.text()).toContain('Hello')
    expect(box.value).toBe('')
  })

  it('edits your own comment, saving only a change', async () => {
    const { server, comments } = mountComments()
    const view = await comments
    server.reply('PUT /comments/c1', { comment: comment({ body: 'Changed', edited: true }) })
    await click(button(t('common.edit')))
    const edit = document.getElementById('comment-edit-c1') as HTMLTextAreaElement
    await press('Enter', edit, { ctrlKey: true })
    expect(server.to('PUT /comments/c1')).toHaveLength(0)

    await click(button(t('common.edit')))
    await type(document.getElementById('comment-edit-c1') as HTMLTextAreaElement, 'Changed')
    await click(button(t('common.save')))
    expect(server.to('PUT /comments/c1')[0].body).toEqual({ body: 'Changed' })
    expect(view.text()).toContain('Changed')

    await click(button(t('common.edit')))
    await press('Escape', document.getElementById('comment-edit-c1'))
    expect(document.getElementById('comment-edit-c1')).toBeNull()
  })

  it('deletes your own comment after asking', async () => {
    const { server, comments } = mountComments()
    const view = await comments
    await click(button(t('common.delete')))
    await click([...document.querySelectorAll('[role="dialog"] button')].find((b) => b.textContent?.trim() === t('common.delete'))!)
    expect(server.to('DELETE /comments/c1')).toHaveLength(1)
    expect(view.text()).toContain(t('comments.empty'))
  })

  it('shows what went wrong', async () => {
    const server = api({ 'GET /comments': status(500), 'POST /comments': status(422, { error: { code: 'V', message: 'Bad', fields: { body: 'Too long' } } }) })
    const view = await render(TaskComments, { props: { taskId: 't-1' }, user: me })
    expect(useToasts().toasts.at(-1)?.message).toBe(t('comments.loadFailed'))
    await type(view.get('textarea').element as HTMLTextAreaElement, 'Hi')
    await view.get('form').trigger('submit')
    await new Promise((r) => setTimeout(r))
    expect(useToasts().toasts.at(-1)?.message).toBe('Too long')
    expect(server.to('POST /comments')).toHaveLength(1)
  })

  it('is closed on an archived task', async () => {
    const { comments } = mountComments([comment()], { readonly: true })
    const view = await comments
    expect(view.find('textarea').exists()).toBe(false)
    expect(view.text()).toContain(t('comments.closed'))
    expect(view.text()).not.toContain(t('common.edit'))
  })
})

describe('TaskComments mentions and Markdown', () => {
  const anna = { id: '0b6e2c1a-7f43-4c2e-9d55-3a1f6c8e2b10', name: 'Anna Kovalenko', email: 'anna@example.com' }

  function mountWithPeople(list: Comment[] = []) {
    const server = api({
      'GET /comments': { comments: list },
      'GET /comments/people': { people: [{ id: me.id, name: me.name, email: me.email }, anna] },
    })
    return { server, comments: render(TaskComments, { props: { taskId: 't-1' }, user: me }) }
  }

  it('shows comments as Markdown, mentions highlighted', async () => {
    const { comments } = mountWithPeople([comment({ body: `**Done**, @[Anna](${anna.id}) <b>x</b>` })])
    const view = await comments
    await new Promise((r) => setTimeout(r))
    expect(view.find('.comment-body strong').text()).toBe('Done')
    expect(view.find('.comment-body .mention').text()).toBe('@Anna')
    expect(view.find('.comment-body b').exists()).toBe(false)
  })

  it('lists who to mention after @ and sends the mention', async () => {
    const { server, comments } = mountWithPeople()
    const view = await comments
    await new Promise((r) => setTimeout(r))
    server.reply('POST /comments', { comment: comment({ id: 'new' }) })
    const box = view.get('textarea').element as HTMLTextAreaElement
    await type(box, 'Hi @ko')
    box.setSelectionRange(6, 6)
    box.dispatchEvent(new KeyboardEvent('keyup', { key: 'o' }))
    await new Promise((r) => setTimeout(r))
    const options = view.findAll('[role="option"]')
    // You aren't offered to yourself.
    expect(options.map((o) => o.text())).toEqual([`${anna.name}${anna.email}`])
    expect(box.getAttribute('aria-expanded')).toBe('true')

    await press('Enter', box)
    expect(box.value).toBe('Hi @Anna Kovalenko ')
    expect(view.find('[role="listbox"]').exists()).toBe(false)
    expect(server.to('POST /comments')).toHaveLength(0)

    await press('Enter', box, { metaKey: true })
    await new Promise((r) => setTimeout(r))
    expect(server.to('POST /comments')[0].body).toEqual({ body: `Hi @[Anna Kovalenko](${anna.id}) ` })
  })

  it('closes the list with Esc without leaving the edit', async () => {
    const { comments } = mountWithPeople([comment({ body: `Ping @[Anna](${anna.id})` })])
    const view = await comments
    await new Promise((r) => setTimeout(r))
    await click(button(t('common.edit')))
    const edit = document.getElementById('comment-edit-c1') as HTMLTextAreaElement
    expect(edit.value).toBe('Ping @Anna Kovalenko')
    await type(edit, 'Ping @')
    edit.setSelectionRange(6, 6)
    edit.dispatchEvent(new KeyboardEvent('keyup', { key: '@' }))
    await new Promise((r) => setTimeout(r))
    expect(view.find('[role="listbox"]').exists()).toBe(true)
    await press('Escape', edit)
    expect(view.find('[role="listbox"]').exists()).toBe(false)
    expect(document.getElementById('comment-edit-c1')).not.toBeNull()
  })
})
