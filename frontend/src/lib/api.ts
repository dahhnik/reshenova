import { getSession } from './auth'

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const session = await getSession()
  const headers = new Headers(init?.headers)
  headers.set('Content-Type', 'application/json')
  if (session?.access_token) {
    headers.set('Authorization', `Bearer ${session.access_token}`)
  }
  const response = await fetch(`/api${path}`, { ...init, headers })
  if (!response.ok) {
    const body = (await response
      .json()
      .catch(() => ({ error: 'Request failed', code: 'UNKNOWN' }))) as {
      error?: string
      code?: string
    }
    throw new ApiError(response.status, body.code ?? 'UNKNOWN', body.error ?? 'Request failed')
  }
  return response.json() as Promise<T>
}
