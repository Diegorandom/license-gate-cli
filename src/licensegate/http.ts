import { LicenseGateAdminClientError } from './errors'

export async function requestJson<T>(
  fetchImplementation: typeof fetch,
  baseUrl: string,
  apiKey: string,
  path: string,
  init?: RequestInit
): Promise<T> {
  const response = await fetchImplementation(`${baseUrl}${path}`, {
    ...init,
    headers: {
      Authorization: apiKey,
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  })

  if (!response.ok) {
    throw await createHttpError(response)
  }

  return (await response.json()) as T
}

export async function requestTrpc<T>(
  fetchImplementation: typeof fetch,
  baseUrl: string,
  apiKey: string,
  procedure: string,
  input: unknown
): Promise<T> {
  const url = new URL(`${baseUrl}/api/trpc/${procedure}`)
  url.searchParams.set('batch', '1')
  url.searchParams.set('input', JSON.stringify({ 0: { json: input } }))

  const response = await fetchImplementation(url.toString(), {
    method: 'GET',
    headers: {
      Authorization: apiKey,
      'Content-Type': 'application/json',
    },
  })

  const payload = (await response.json()) as unknown
  if (!response.ok) {
    throw createTrpcError(response.status, payload)
  }

  return unwrapTrpcResponse<T>(payload)
}

async function createHttpError(response: Response) {
  const contentType = response.headers.get('content-type') ?? ''

  if (contentType.startsWith('application/json')) {
    const payload = (await response.json()) as {
      error?: string
      message?: string
      details?: unknown
    }

    return new LicenseGateAdminClientError(
      payload.message ?? detailsToMessage(payload.details) ?? response.statusText,
      {
        status: response.status,
        code: payload.error,
        details: payload.details,
      }
    )
  }

  return new LicenseGateAdminClientError(await response.text(), {
    status: response.status,
  })
}

function createTrpcError(status: number, payload: unknown) {
  const response = payload as any
  const message = response?.error?.message ?? response?.message ?? 'Unknown error'
  return new LicenseGateAdminClientError(message, {
    status,
    code: response?.error?.code,
    details: response,
  })
}

function unwrapTrpcResponse<T>(payload: unknown) {
  if (Array.isArray(payload)) {
    const first = payload[0] as any
    return (first?.result?.data?.json ?? first?.result?.data ?? first) as T
  }

  const response = payload as any
  return (response?.result?.data?.json ?? response?.result?.data ?? response) as T
}

function detailsToMessage(details: unknown) {
  if (typeof details === 'string') return details
  return undefined
}
