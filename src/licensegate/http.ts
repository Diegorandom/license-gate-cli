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

function detailsToMessage(details: unknown) {
  if (typeof details === 'string') return details
  return undefined
}
