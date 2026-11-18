import axios, { type InternalAxiosRequestConfig } from 'axios'
import { toast } from 'sonner'
import { signOut } from './auth'
import { supabase } from './supabase'

// An error from our API. `message` is always safe to show to the user;
// `status` is the HTTP status (0 when the server couldn't be reached).
export class ApiError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

// One axios instance for the whole app. Paths are relative to /api, which Vite
// proxies to Express in dev and Express serves itself in production.
const http = axios.create({ baseURL: '/api' })

// When the server can't be reached, a GET is retried after 3s and then 5s before
// giving up (covers the API restarting, e.g. tsx watch in dev or a deploy).
// Only GETs: repeating a POST could, say, send a chat message twice.
const RETRY_DELAYS_MS = [3_000, 5_000]
type RetryConfig = InternalAxiosRequestConfig & { retryCount?: number }
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

// Attach the current Supabase access token to every request.
// getSession() also refreshes the token first if it has expired.
http.interceptors.request.use(async (config) => {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// Turn every failure into an ApiError with a readable message, so callers only
// need `catch (e) { toast.error(e.message) }`.
http.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (!axios.isAxiosError<{ error?: string }>(error)) {
      return Promise.reject(new ApiError('Something went wrong', 0))
    }

    const status = error.response?.status ?? 0

    // No response, or the dev proxy saying Express isn't running.
    if (status === 0 || status === 502 || status === 503 || status === 504) {
      // The server may just be restarting: retry GETs a couple of times first.
      const config = error.config as RetryConfig | undefined
      const attempt = config?.retryCount ?? 0
      if (config?.method === 'get' && attempt < RETRY_DELAYS_MS.length) {
        config.retryCount = attempt + 1
        await sleep(RETRY_DELAYS_MS[attempt])
        return http(config) // goes through the interceptors again (fresh token too)
      }
      return Promise.reject(new ApiError("Can't reach the server. Please try again.", status))
    }

    // The session is gone (expired or revoked): sign out so the login screen shows.
    // Signing out clears all toasts (App.tsx), so the reason is shown after it.
    // The fixed id keeps it to one toast when several requests fail together.
    if (status === 401) {
      const message = 'Your session has expired. Please sign in again.'
      signOut().then(() => toast.error(message, { id: 'session-expired' }))
      return Promise.reject(new ApiError(message, status))
    }

    const message = error.response?.data?.error ?? `Request failed (${status})`
    return Promise.reject(new ApiError(message, status))
  },
)

// Small typed helpers used everywhere instead of calling axios directly.
// Each returns the response body and throws ApiError on failure.
export async function getRequest<T>(url: string): Promise<T> {
  const res = await http.get<T>(url)
  return res.data
}

export async function postRequest<T>(url: string, body?: unknown): Promise<T> {
  const res = await http.post<T>(url, body)
  return res.data
}

export async function patchRequest<T>(url: string, body?: unknown): Promise<T> {
  const res = await http.patch<T>(url, body)
  return res.data
}

export async function deleteRequest<T = void>(url: string): Promise<T> {
  const res = await http.delete<T>(url)
  return res.data
}

// For catch blocks: errors from the helpers above are already readable.
export function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : 'Something went wrong'
}
