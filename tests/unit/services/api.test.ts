import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AxiosError, type AxiosAdapter, type InternalAxiosRequestConfig } from 'axios'
import { http, ApiRequestError, onUnauthorized } from '@/services/api'
import { t } from '@/i18n'

type Reply = { status: number; data?: unknown }

const original = http.defaults.adapter
let calls: string[] = []

/** Answers each request with the next reply listed for its URL, as the network would. */
function serve(replies: Record<string, Reply[]>) {
  calls = []
  const adapter: AxiosAdapter = async (config: InternalAxiosRequestConfig) => {
    const url = config.url ?? ''
    calls.push(`${config.method?.toUpperCase()} ${url}`)
    const reply = replies[url]?.shift() ?? { status: 200, data: {} }
    const response = { data: reply.data, status: reply.status, statusText: '', headers: {}, config }
    if (reply.status >= 400) throw new AxiosError('failed', String(reply.status), config, null, response)
    return response
  }
  http.defaults.adapter = adapter
}

const apiError = (code: string, message: string) => ({ error: { code, message } })

let expired: ReturnType<typeof vi.fn>

beforeEach(() => {
  expired = vi.fn()
  onUnauthorized(expired)
})

afterEach(() => {
  http.defaults.adapter = original
})

describe('the API client', () => {
  it('sends the interface language', async () => {
    let language = ''
    http.defaults.adapter = async (config) => {
      language = String(config.headers.get('Accept-Language'))
      return { data: {}, status: 200, statusText: '', headers: {}, config }
    }
    await http.get('/tasks')
    expect(language).toBe('en')
  })

  it('turns an API error into an ApiRequestError with its fields', async () => {
    serve({ '/tasks': [{ status: 422, data: { error: { code: 'VALIDATION', message: 'Bad', fields: { title: 'Required' } } } }] })
    const error = await http.post('/tasks').catch((e: unknown) => e)
    expect(error).toBeInstanceOf(ApiRequestError)
    expect(error).toMatchObject({ status: 422, code: 'VALIDATION', message: 'Bad', fields: { title: 'Required' } })
  })

  it('says the server can’t be reached when there is no answer', async () => {
    http.defaults.adapter = async (config) => {
      throw new AxiosError('Network Error', 'ERR_NETWORK', config)
    }
    const error = await http.get('/tasks').catch((e: unknown) => e)
    expect(error).toMatchObject({ status: 0, code: 'NETWORK_ERROR', message: t('errors.network') })
  })

  it('refreshes an expired access token and tries the request again', async () => {
    serve({ '/tasks': [{ status: 401 }, { status: 200, data: { tasks: ['ok'] } }] })
    const { data } = await http.get('/tasks')
    expect(data).toEqual({ tasks: ['ok'] })
    expect(calls).toEqual(['GET /tasks', 'POST /auth/refresh', 'GET /tasks'])
    expect(expired).not.toHaveBeenCalled()
  })

  it('shares one refresh between requests that fail together', async () => {
    serve({ '/a': [{ status: 401 }], '/b': [{ status: 401 }] })
    await Promise.all([http.get('/a'), http.get('/b')])
    expect(calls.filter((c) => c === 'POST /auth/refresh')).toHaveLength(1)
  })

  it('ends the session when the refresh is refused', async () => {
    serve({ '/tasks': [{ status: 401, data: apiError('UNAUTHORIZED', 'Signed out') }], '/auth/refresh': [{ status: 401 }] })
    const error = await http.get('/tasks').catch((e: unknown) => e)
    expect(error).toMatchObject({ status: 401, message: 'Signed out' })
    expect(expired).toHaveBeenCalledOnce()
  })

  it('fails the request but keeps the session when refreshing is rate limited', async () => {
    serve({ '/tasks': [{ status: 401 }], '/auth/refresh': [{ status: 429, data: apiError('RATE_LIMITED', 'Slow down') }] })
    const error = await http.get('/tasks').catch((e: unknown) => e)
    expect(error).toMatchObject({ status: 429, code: 'RATE_LIMITED', message: t('errors.tooManyRequests') })
    expect(expired).not.toHaveBeenCalled()
  })

  it('tries only once: a second 401 after the refresh ends the session', async () => {
    serve({ '/tasks': [{ status: 401 }, { status: 401 }] })
    await http.get('/tasks').catch(() => {})
    expect(calls).toEqual(['GET /tasks', 'POST /auth/refresh', 'GET /tasks'])
    expect(expired).toHaveBeenCalledOnce()
  })

  it('passes a 403 straight through: two-factor sign-in answers with it, the session is fine', async () => {
    serve({ '/invites/accept': [{ status: 403, data: apiError('TWO_FACTOR_REQUIRED', 'Code needed') }] })
    const error = await http.post('/invites/accept').catch((e: unknown) => e)
    expect(error).toMatchObject({ status: 403, code: 'TWO_FACTOR_REQUIRED' })
    expect(calls).toEqual(['POST /invites/accept'])
    expect(expired).not.toHaveBeenCalled()
  })

  it('takes a 401 from a sign-in or /me as “not signed in”, not an expired session', async () => {
    serve({ '/auth/login': [{ status: 401 }], '/me': [{ status: 401 }], '/auth/refresh': [{ status: 401 }] })
    await http.post('/auth/login').catch(() => {})
    expect(calls).toEqual(['POST /auth/login'])
    await http.get('/me').catch(() => {})
    expect(expired).not.toHaveBeenCalled()
  })
})
