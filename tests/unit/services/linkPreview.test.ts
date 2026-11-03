import { afterEach, describe, expect, it } from 'vitest'
import type { InternalAxiosRequestConfig } from 'axios'
import { http } from '@/services/api'
import { fetchPageTitle } from '@/services/linkPreview'

const original = http.defaults.adapter
afterEach(() => {
  http.defaults.adapter = original
})

describe('fetchPageTitle', () => {
  it('asks the server once per page, and forgets a failure', async () => {
    const sent: InternalAxiosRequestConfig[] = []
    let fail = true
    http.defaults.adapter = async (config) => {
      sent.push(config)
      if (fail) return Promise.reject(Object.assign(new Error('no'), { response: { status: 422, data: {} }, config }))
      return { data: { title: '  The page ' }, status: 200, statusText: '', headers: {}, config }
    }
    expect(await fetchPageTitle('https://a.io/x')).toBeNull()
    fail = false
    expect(await fetchPageTitle('https://a.io/x')).toBe('The page')
    expect(await fetchPageTitle('https://a.io/x')).toBe('The page')
    expect(sent).toHaveLength(2)
    expect(sent[1].method).toBe('post')
    expect(sent[1].url).toBe('/link-preview')
    expect(JSON.parse(sent[1].data as string)).toEqual({ url: 'https://a.io/x' })
  })
})
