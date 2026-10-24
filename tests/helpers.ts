/**
 * Mounting components as the app runs them: the app's own routes (in memory),
 * a signed-in user, and a made-up server behind the real API client.
 */
import { flushPromises, mount, type ComponentMountingOptions } from '@vue/test-utils'
import { createMemoryHistory, createRouter, type Router } from 'vue-router'
import type { InternalAxiosRequestConfig } from 'axios'
import { AxiosError } from 'axios'
import type { Component } from 'vue'
import { http } from '@/services/api'
import { routes } from '@/router'
import { useAuthStore } from '@/stores/auth'
import type { User } from '@/types/auth'

export interface Call {
  method: string
  url: string
  body: unknown
  params: Record<string, unknown>
}

/** Answers a call; its parameter is bivariant, so a test may name just the part of the call it reads. */
type Responder = { answer(call: Call): unknown }['answer']

export type Reply = Responder | object

/** A reply with a status other than 200. */
export function status(code: number, data: unknown = { error: { code: String(code), message: `Error ${code}` } }) {
  return { __status: code, data }
}

/**
 * Serves the API from a table of "METHOD /path" → reply; a reply may be a
 * function of the call. Anything else answers {}. Calls are recorded.
 */
export function api(table: Record<string, Reply> = {}) {
  const calls: Call[] = []
  const replies = { ...table }
  http.defaults.adapter = async (config: InternalAxiosRequestConfig) => {
    const method = (config.method ?? 'get').toUpperCase()
    const url = config.url ?? ''
    let body: unknown = config.data
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body)
      } catch {
        // not JSON: kept as sent
      }
    }
    const call: Call = { method, url, body, params: (config.params ?? {}) as Record<string, unknown> }
    calls.push(call)
    let reply: unknown = replies[`${method} ${url}`] ?? {}
    if (typeof reply === 'function') reply = (reply as Responder)(call)
    if (reply && typeof reply === 'object' && '__status' in reply) {
      const { __status, data } = reply as { __status: number; data: unknown }
      const response = { data, status: __status, statusText: '', headers: {}, config }
      throw new AxiosError('failed', String(__status), config, null, response)
    }
    return { data: reply, status: 200, statusText: '', headers: {}, config }
  }
  return {
    calls,
    /** Changes what a request answers from now on. */
    reply(key: string, value: Reply) {
      replies[key] = value
    },
    /** The calls made to "METHOD /path". */
    to(key: string) {
      return calls.filter((c) => `${c.method} ${c.url}` === key)
    },
  }
}

export function signIn(user: User | null) {
  const auth = useAuthStore()
  auth.user = user
  auth.isInitialized = true
  return auth
}

export function makeRouter(): Router {
  return createRouter({ history: createMemoryHistory(), routes })
}

/** Mounts a component at a path, signed in as user, and waits for what it loads on mount. */
export async function render<C extends Component>(
  component: C,
  { path = '/', user, ...options }: ComponentMountingOptions<C> & { path?: string; user?: User | null } = {},
) {
  if (user !== undefined) signIn(user)
  const router = makeRouter()
  await router.push(path)
  const wrapper = mount(component, {
    attachTo: document.body,
    ...options,
    global: { ...options.global, plugins: [router, ...(options.global?.plugins ?? [])] },
  } as ComponentMountingOptions<C>)
  await flushPromises()
  return Object.assign(wrapper, { router })
}
