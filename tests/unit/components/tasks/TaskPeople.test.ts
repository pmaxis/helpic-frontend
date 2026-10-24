import { describe, expect, it } from 'vitest'
import { defineComponent, h } from 'vue'
import TaskPeople from '@/components/tasks/TaskPeople.vue'
import { t } from '@/i18n'
import type { Task, TaskPerson } from '@/types/tasks'
import { api, render, status } from '../../../helpers'
import { $$, click } from '../../../dom'
import { makeTask, makeUser } from '../../../fixtures'
import { useToasts } from '@/composables/useToasts'

const owner = makeUser({ id: 'u-client', role: 'client', name: 'Acme', email: 'acme@example.test' })
const person = (id: string, role: TaskPerson['role'], on_task = false): TaskPerson => ({ id, name: id, email: `${id}@example.test`, role, on_task })

/** TaskPeople renders a <dt> and a <dd>: it lives in a <dl>. */
function inList(task: Task) {
  return defineComponent({ setup: (_, { attrs }) => () => h('dl', [h(TaskPeople, { task, ...attrs })]) })
}

async function mountPeople(task: Task, people: TaskPerson[], user = owner) {
  const server = api({ [`GET /tasks/${task.id}/people`]: { people } })
  const view = await render(inList(task), { user })
  return { server, view }
}

const options = () => $$('[role="checkbox"]')

describe('TaskPeople', () => {
  it('lets the client side swap the freelancer and add its team', async () => {
    const task = makeTask({ created_by: owner.id, creator: owner, project: { id: 'p', name: 'P' } })
    const { server, view } = await mountPeople(task, [
      person('u-freelancer', 'freelancer', true),
      person('other-freelancer', 'freelancer'),
      person('member', 'member'),
      person(owner.id, 'owner', true),
    ])
    await click(view.get('button').element)
    expect(options().map((o) => o.textContent?.trim())).toHaveLength(4)

    await click(options().find((o) => o.textContent?.includes('other-freelancer'))!)
    expect(server.to('PUT /tasks/t-1/freelancer')[0].body).toEqual({ freelancer_id: 'other-freelancer' })

    await click(options().find((o) => o.textContent?.includes('member'))!)
    expect(server.to('POST /tasks/t-1/participants')[0].body).toEqual({ user_id: 'member' })
    expect(view.findComponent(TaskPeople).emitted('changed')).toHaveLength(2)
  })

  it('takes someone off, and keeps the author on', async () => {
    const task = makeTask({ created_by: owner.id, creator: owner, project: { id: 'p', name: 'P' } })
    const { server, view } = await mountPeople(task, [person('u-freelancer', 'freelancer', true), person('member', 'member', true), person(owner.id, 'owner', true)])
    await click(view.get('button').element)
    await click(options().find((o) => o.textContent?.includes('member'))!)
    expect(server.to('DELETE /tasks/t-1/participants/member')).toHaveLength(1)
    await click(options().find((o) => o.textContent?.includes(t('common.you')))!)
    expect(server.calls.filter((c) => c.method !== 'GET')).toHaveLength(1)
  })

  it('shows a freelancer only the freelancer on the task, and says when a change fails', async () => {
    const task = makeTask({ project: { id: 'p', name: 'P' } })
    const { server, view } = await mountPeople(task, [person('u-freelancer', 'freelancer', true), person('other', 'freelancer'), person('member', 'member')], makeUser())
    await click(view.get('button').element)
    expect(options().some((o) => o.textContent?.includes('other'))).toBe(false)
    server.reply('POST /tasks/t-1/participants', status(403, { error: { code: 'X', message: 'Not yours' } }))
    await click(options().find((o) => o.textContent?.includes('member'))!)
    expect(useToasts().toasts.at(-1)?.message).toBe('Not yours')
  })

  it('lists who is on an archived or personal task, unchangeable', async () => {
    const archived = makeTask({ archived_at: '2030-01-01' })
    const { view } = await mountPeople(archived, [person('u-freelancer', 'freelancer', true)])
    expect(view.find('button').exists()).toBe(false)
    expect(view.text()).toContain('u-freelancer')

    const personal = makeTask({ client: null, archived_at: '2030-01-01' })
    const { server, view: mine } = await mountPeople(personal, [], makeUser())
    expect(server.calls).toHaveLength(0)
    expect(mine.text()).toContain(t('common.you'))
  })
})
