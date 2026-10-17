import axios, { AxiosError, type AxiosInstance, type InternalAxiosRequestConfig } from 'axios'
import type { ApiError } from '@/types/auth'

const baseURL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8090/api/v1'

/**
 * Single axios instance for the whole app. Every request sends cookies
 * (withCredentials) so the HttpOnly access and refresh cookies are included
 * automatically.
 */
export const http: AxiosInstance = axios.create({
  baseURL,
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
})

type UnauthorizedHandler = () => void

let unauthorizedHandler: UnauthorizedHandler | null = null

/**
 * Register a callback invoked whenever the API returns 401 for a request that
 * was not itself an auth check. Used to reset auth state on session expiry.
 */
export function onUnauthorized(handler: UnauthorizedHandler): void {
  unauthorizedHandler = handler
}

/** Normalized error thrown by every API call in this app. */
export class ApiRequestError extends Error {
  code: string
  status: number
  fields?: Record<string, string>

  constructor(status: number, apiError: ApiError) {
    super(apiError.message)
    this.name = 'ApiRequestError'
    this.status = status
    this.code = apiError.code
    this.fields = apiError.fields
  }
}

/** A 401 from these means "not signed in" or "wrong password", not "the session expired". */
function isAuthProbe(url: string): boolean {
  return url === '/me' || url.startsWith('/auth/')
}

let refreshing: Promise<boolean> | null = null

/**
 * Swaps the refresh cookie for a new access cookie. Requests that fail
 * together share one refresh: each refresh replaces the refresh token, so
 * sending the same one twice would look like a stolen copy.
 */
function refreshSession(): Promise<boolean> {
  refreshing ??= http
    .post('/auth/refresh')
    .then(
      () => true,
      () => false,
    )
    .finally(() => {
      refreshing = null
    })
  return refreshing
}

type RetriableConfig = InternalAxiosRequestConfig & { _retried?: boolean }

http.interceptors.response.use(
  (response) => response,
  async (error: AxiosError<{ error?: ApiError }>) => {
    const status = error.response?.status ?? 0
    const config = error.config as RetriableConfig | undefined
    const url = config?.url ?? ''

    // The access token is short-lived: refresh it and try once more.
    if (status === 401 && config && !config._retried && !url.startsWith('/auth/')) {
      config._retried = true
      if (await refreshSession()) return http(config)
    }

    if (status === 401 && !isAuthProbe(url)) {
      unauthorizedHandler?.()
    }

    const apiError: ApiError = error.response?.data?.error ?? {
      code: 'NETWORK_ERROR',
      message: 'Unable to reach the server. Please try again.',
    }

    return Promise.reject(new ApiRequestError(status, apiError))
  },
)
