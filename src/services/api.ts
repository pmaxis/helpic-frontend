import axios, { AxiosError, type AxiosInstance } from 'axios'
import type { ApiError } from '@/types/auth'

const baseURL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8090/api/v1'

/**
 * Single axios instance for the whole app. Every request sends cookies
 * (withCredentials) so the HttpOnly JWT cookie is included automatically.
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

const AUTH_PROBE_PATHS = ['/me', '/auth/login', '/auth/register']

http.interceptors.response.use(
  (response) => response,
  (error: AxiosError<{ error?: ApiError }>) => {
    const status = error.response?.status ?? 0
    const url = error.config?.url ?? ''

    if (status === 401 && !AUTH_PROBE_PATHS.some((p) => url.includes(p))) {
      unauthorizedHandler?.()
    }

    const apiError: ApiError = error.response?.data?.error ?? {
      code: 'NETWORK_ERROR',
      message: 'Unable to reach the server. Please try again.',
    }

    return Promise.reject(new ApiRequestError(status, apiError))
  },
)
