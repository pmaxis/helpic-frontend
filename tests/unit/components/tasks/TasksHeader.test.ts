import { describe, expect, it } from 'vitest'
import TasksHeader from '@/components/tasks/TasksHeader.vue'
import { t } from '@/i18n'
import { render } from '../../../helpers'
import { $ } from '../../../dom'
import { makeUser } from '../../../fixtures'

const head = (backlogCount: number | null) =>
  render(TasksHeader, { props: { active: 'board', projectId: '', projectOptions: [], backlogTo: '/backlog', backlogCount }, user: makeUser() })

describe('TasksHeader', () => {
  it('counts the backlog on its button’s corner, 99+ past that, nothing at none', async () => {
    let view = await head(7)
    expect($('[data-backlog-count]')!.textContent?.trim()).toBe('7')
    expect($('[data-backlog-button]')!.getAttribute('aria-label')).toBe(`${t('backlog.open')} · ${t('backlog.count', { n: 7 }, 7)}`)
    view.unmount()

    view = await head(150)
    expect($('[data-backlog-count]')!.textContent?.trim()).toBe('99+')
    view.unmount()

    view = await head(0)
    expect($('[data-backlog-count]')).toBeNull()
    expect($('[data-backlog-button]')!.getAttribute('aria-label')).toBe(t('backlog.open'))
    view.unmount()

    await head(null)
    expect($('[data-backlog-count]')).toBeNull()
  })
})
