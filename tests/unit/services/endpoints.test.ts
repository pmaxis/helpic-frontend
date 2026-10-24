/**
 * Every API call goes to the endpoint the backend serves, with the body it
 * reads, and hands back the part of the answer the app uses.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { InternalAxiosRequestConfig } from 'axios'
import { http } from '@/services/api'
import * as account from '@/services/account'
import * as archive from '@/services/archive'
import * as attachments from '@/services/attachments'
import * as comments from '@/services/comments'
import * as emailNotifications from '@/services/emailNotifications'
import * as history from '@/services/history'
import * as projectPeople from '@/services/projectPeople'
import * as sessions from '@/services/sessions'
import * as taskPeople from '@/services/taskPeople'
import * as team from '@/services/team'
import * as telegram from '@/services/telegram'
import * as time from '@/services/time'
import * as twoFactor from '@/services/twoFactor'
import * as admin from '@/admin/api'
import { fetchColumns, fetchLabels, createLabel, updateLabel, deleteLabel } from '@/stores/board'

/** What the server sends back: the same object under every key the calls unwrap. */
const X = { marker: true }
const ANSWER = Object.fromEntries(
  [
    'user', 'task', 'team', 'invite', 'comment', 'comments', 'events', 'people', 'sessions', 'telegram', 'link',
    'email_notifications', 'recovery_codes', 'participants', 'candidates', 'attachment', 'limits', 'admins', 'email', 'entry', 'entries', 'timer', 'label', 'labels',
  ].map((k) => [k, X]),
)

let sent: InternalAxiosRequestConfig | undefined
const original = http.defaults.adapter

beforeEach(() => {
  sent = undefined
  http.defaults.adapter = async (config) => {
    sent = config
    return { data: ANSWER, status: 200, statusText: '', headers: {}, config }
  }
})

afterEach(() => {
  http.defaults.adapter = original
})

type Case = [name: string, call: () => Promise<unknown>, method: string, url: string, body?: unknown]

const cases: Case[] = [
  ['forgotPassword', () => account.forgotPassword('a@b.c'), 'post', '/auth/password/forgot', { email: 'a@b.c' }],
  ['resetPassword', () => account.resetPassword({ token: 't', password: 'p', password_confirmation: 'p' }), 'post', '/auth/password/reset'],
  ['confirmEmail', () => account.confirmEmail('t'), 'post', '/email-changes/confirm', { token: 't' }],
  ['deleteAttachment', () => attachments.deleteAttachment('f1'), 'delete', '/attachments/f1'],
  ['listComments', () => comments.listComments('t1'), 'get', '/comments'],
  ['createComment', () => comments.createComment('t1', 'Hi'), 'post', '/comments', { body: 'Hi' }],
  ['updateComment', () => comments.updateComment('c1', 'Edit'), 'put', '/comments/c1', { body: 'Edit' }],
  ['deleteComment', () => comments.deleteComment('c1'), 'delete', '/comments/c1'],
  ['fetchEmailNotifications', () => emailNotifications.fetchEmailNotifications(), 'get', '/me/email-notifications'],
  ['setEmailNotificationKinds', () => emailNotifications.setEmailNotificationKinds([]), 'put', '/me/email-notifications', { kinds: [] }],
  ['fetchHistory', () => history.fetchHistory('t1'), 'get', '/tasks/t1/history'],
  ['fetchProjectPeople', () => projectPeople.fetchProjectPeople('p1'), 'get', '/projects/p1/people'],
  ['inviteToProject', () => projectPeople.inviteToProject('p1', ['u']), 'post', '/projects/p1/participants', { user_ids: ['u'] }],
  ['removeProjectParticipant', () => projectPeople.removeProjectParticipant('p1', 'u'), 'delete', '/projects/p1/participants/u'],
  ['fetchSessions', () => sessions.fetchSessions(), 'get', '/me/sessions'],
  ['endSession', () => sessions.endSession('s1'), 'delete', '/me/sessions/s1'],
  ['endOtherSessions', () => sessions.endOtherSessions(), 'delete', '/me/sessions'],
  ['fetchTaskPeople', () => taskPeople.fetchTaskPeople('t1'), 'get', '/tasks/t1/people'],
  ['assignTaskFreelancer', () => taskPeople.assignTaskFreelancer('t1', 'f'), 'put', '/tasks/t1/freelancer', { freelancer_id: 'f' }],
  ['addTaskParticipant', () => taskPeople.addTaskParticipant('t1', 'u'), 'post', '/tasks/t1/participants', { user_id: 'u' }],
  ['removeTaskParticipant', () => taskPeople.removeTaskParticipant('t1', 'u'), 'delete', '/tasks/t1/participants/u'],
  ['fetchTeam', () => team.fetchTeam(), 'get', '/team'],
  ['renameTeam', () => team.renameTeam('Acme'), 'put', '/team', { name: 'Acme' }],
  ['inviteToTeam', () => team.inviteToTeam('a@b.c', 'A', 'member'), 'post', '/team/invites', { email: 'a@b.c', name: 'A', role: 'member' }],
  ['setTeamMemberRole', () => team.setTeamMemberRole('m1', 'contractor'), 'put', '/team/members/m1', { role: 'contractor' }],
  ['revokeTeamInvite', () => team.revokeTeamInvite('i1'), 'delete', '/team/invites/i1'],
  ['removeTeamMember', () => team.removeTeamMember('m1'), 'delete', '/team/members/m1'],
  ['lookupTeamInvite', () => team.lookupTeamInvite('t'), 'post', '/team-invites/lookup', { token: 't' }],
  ['fetchTelegram', () => telegram.fetchTelegram(), 'get', '/me/telegram'],
  ['createTelegramLink', () => telegram.createTelegramLink(), 'post', '/me/telegram/link'],
  ['setTelegramKinds', () => telegram.setTelegramKinds([]), 'put', '/me/telegram/kinds', { kinds: [] }],
  ['disconnectTelegram', () => telegram.disconnectTelegram(), 'delete', '/me/telegram'],
  ['listTimeEntries', () => time.listTimeEntries('t1'), 'get', '/time-entries'],
  ['createTimeEntry', () => time.createTimeEntry('t1', { spent_on: '2030-01-01', duration: '1h', note: '' }), 'post', '/time-entries'],
  ['updateTimeEntry', () => time.updateTimeEntry('e1', { spent_on: '2030-01-01', duration: '1h', note: '' }), 'put', '/time-entries/e1'],
  ['deleteTimeEntry', () => time.deleteTimeEntry('e1'), 'delete', '/time-entries/e1'],
  ['fetchTimer', () => time.fetchTimer(), 'get', '/timer'],
  ['startTimer', () => time.startTimer('t1'), 'post', '/timer'],
  ['stopTimer', () => time.stopTimer(), 'post', '/timer/stop'],
  ['fetchTwoFactor', () => twoFactor.fetchTwoFactor(), 'get', '/me/two-factor'],
  ['beginTwoFactor', () => twoFactor.beginTwoFactor('pw'), 'post', '/me/two-factor/setup', { current_password: 'pw' }],
  ['enableTwoFactor', () => twoFactor.enableTwoFactor('123456'), 'post', '/me/two-factor/enable', { code: '123456' }],
  ['disableTwoFactor', () => twoFactor.disableTwoFactor({ current_password: 'pw', code: '1' }), 'post', '/me/two-factor/disable'],
  ['renewRecoveryCodes', () => twoFactor.renewRecoveryCodes({ current_password: 'pw', code: '1' }), 'post', '/me/two-factor/recovery-codes'],
  ['fetchColumns', () => fetchColumns({ project: 'p1' }), 'get', '/board/columns'],
  ['fetchLabels', () => fetchLabels({ with: 'c1' }), 'get', '/board/labels'],
  ['createLabel', () => createLabel({ with: 'c1' }, 'Bug', 'red'), 'post', '/board/labels', { with: 'c1', name: 'Bug', color: 'red' }],
  ['updateLabel', () => updateLabel('l1', 'Bug', 'red'), 'put', '/board/labels/l1', { name: 'Bug', color: 'red' }],
  ['deleteLabel', () => deleteLabel('l1'), 'delete', '/board/labels/l1'],
  ['fetchAdminStats', () => admin.fetchAdminStats(30), 'get', '/admin/stats'],
  ['fetchAdminAccount', () => admin.fetchAdminAccount('u1'), 'get', '/admin/users/u1'],
  ['actOnAccount', () => admin.actOnAccount('u1', 'block', 'spam', '123456'), 'post', '/admin/users/u1/block', { reason: 'spam', code: '123456' }],
  ['retryEmail', () => admin.retryEmail('e1'), 'post', '/admin/emails/e1/retry'],
  ['resendSignup', () => admin.resendSignup('a+b@c.d'), 'post', '/admin/signups/a%2Bb%40c.d/resend'],
  ['deleteSignup', () => admin.deleteSignup('a+b@c.d'), 'delete', '/admin/signups/a%2Bb%40c.d'],
  ['fetchAdminSystem', () => admin.fetchAdminSystem(), 'get', '/admin/system'],
  ['sendTestAlert', () => admin.sendTestAlert(), 'post', '/admin/system/test-alert'],
  ['fetchAccountSessions', () => admin.fetchAccountSessions('u1'), 'get', '/admin/users/u1/sessions'],
  ['endAccountSession', () => admin.endAccountSession('u1', 's1', 'r', 'c'), 'post', '/admin/users/u1/sessions/s1/end', { reason: 'r', code: 'c' }],
  ['clearAdminLimit', () => admin.clearAdminLimit({ scope: 'sign-in', key: 'k' }), 'post', '/admin/limits/clear', { scope: 'sign-in', key: 'k' }],
  ['fetchAdmins', () => admin.fetchAdmins(), 'get', '/admin/admins'],
  ['endAdminSession', () => admin.endAdminSession('a1', 's1', 'r', 'c'), 'post', '/admin/admins/a1/sessions/s1/end', { reason: 'r', code: 'c' }],
]

describe('API endpoints', () => {
  it.each(cases)('%s', async (_name, call, method, url, body) => {
    const result = await call()
    expect(sent?.method).toBe(method)
    expect(sent?.url).toBe(url)
    if (body !== undefined) expect(JSON.parse(String(sent?.data))).toEqual(body)
    // A call that returns something returns the answer, or the part of it under its key.
    if (result !== undefined) expect(result === X || result === ANSWER || JSON.stringify(result).includes('marker')).toBe(true)
  })

  it('leaves out the empty filters of an admin listing', async () => {
    for (const call of [
      () => admin.fetchAdminAccounts({ q: '', role: 'client', page: 2 } as never),
      () => admin.fetchAdminLogs({ q: '', level: 'error' } as never),
      () => admin.fetchAdminActions({ target: 'u1', action: undefined } as never),
      () => admin.fetchAdminEmails({ q: '', status: 'failed' } as never),
      () => admin.fetchAdminSignups({ q: 'a', page: undefined } as never),
      () => admin.fetchAdminLimits({ q: '', account: 'u1' }),
      () => admin.fetchAdminSignIns({ failed: true, admin: '' }),
    ]) {
      await call()
      expect(Object.values(sent?.params ?? {})).not.toContain('')
      expect(Object.values(sent?.params ?? {})).not.toContain(undefined)
    }
  })

  it('asks for an archive page only past the first', async () => {
    await archive.fetchArchive({ page: 1, with: '' })
    expect(sent?.params).toEqual({ with: undefined, project: undefined, page: undefined })
    await archive.fetchArchive({ page: 3, project: 'p1' })
    expect(sent?.params).toEqual({ with: undefined, project: 'p1', page: 3 })
  })
})

describe('attachments', () => {
  it('lists a task’s files with the largest size the server takes', async () => {
    http.defaults.adapter = async (config) => ({ data: { attachments: [X], max_size_bytes: 1024 }, status: 200, statusText: '', headers: {}, config })
    expect(await attachments.listAttachments('t1')).toEqual({ attachments: [X], maxSize: 1024 })
  })

  it('uploads as multipart, reporting the share sent', async () => {
    const progress = vi.fn()
    http.defaults.adapter = async (config) => {
      config.onUploadProgress?.({ loaded: 50, total: 200, bytes: 50, lengthComputable: true } as never)
      config.onUploadProgress?.({ loaded: 0, bytes: 0, lengthComputable: false } as never)
      sent = config
      return { data: { attachment: X }, status: 200, statusText: '', headers: {}, config }
    }
    expect(await attachments.uploadAttachment('t1', new File(['x'], 'a.txt'), progress)).toBe(X)
    expect(sent?.data).toBeInstanceOf(FormData)
    expect(sent?.params).toEqual({ task: 't1' })
    expect(progress.mock.calls).toEqual([[0.25], [0]])
  })

  it('downloads a file under its own name', async () => {
    vi.useFakeTimers()
    URL.createObjectURL = vi.fn(() => 'blob:file')
    URL.revokeObjectURL = vi.fn()
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    await attachments.downloadAttachment({ id: 'f1', file_name: 'brief.pdf' } as never)
    expect(click).toHaveBeenCalledOnce()
    expect(click.mock.contexts[0]).toMatchObject({ download: 'brief.pdf' })
    vi.advanceTimersByTime(1000)
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:file')
    vi.useRealTimers()

    await attachments.attachmentURL('f1', true)
    expect(sent?.params).toEqual({ inline: 1 })
  })

  it('writes sizes in B, KB and MB', () => {
    expect([attachments.formatSize(840), attachments.formatSize(12 * 1024), attachments.formatSize(3.4 * 1024 * 1024), attachments.formatSize(1.2 * 1024 ** 3)]).toEqual([
      '840 B',
      '12 KB',
      '3.4 MB',
      '1.2 GB',
    ])
  })
})

describe('project people', () => {
  it('gives empty lists when the server leaves them out', async () => {
    http.defaults.adapter = async (config) => ({ data: {}, status: 200, statusText: '', headers: {}, config })
    for (const call of [
      () => projectPeople.fetchProjectPeople('p1'),
      () => projectPeople.inviteToProject('p1', []),
      () => projectPeople.removeProjectParticipant('p1', 'u'),
    ])
      expect(await call()).toEqual({ participants: [], candidates: [] })
  })
})

describe('joining a team', () => {
  it('sends the token with the new account', async () => {
    await team.joinTeam('tok', { name: 'A', password: 'p', password_confirmation: 'p' } as never)
    expect(sent?.url).toBe('/team-invites/accept')
    expect(JSON.parse(String(sent?.data))).toMatchObject({ token: 'tok', name: 'A' })
  })
})
