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
  if (details && typeof details === 'object') {
    // La API devuelve `details` como objeto campo → { message, value } cuando el
    // esquema no valida (422). Sin esto el error sale como «Unprocessable Entity»
    // y no dice qué campo ni por qué — que es lo único que sirve para arreglarlo.
    const entries = Object.entries(details as Record<string, unknown>)
    if (entries.length === 0) return undefined
    return entries
      .map(([field, info]) => {
        if (info && typeof info === 'object' && 'message' in (info as Record<string, unknown>)) {
          const { message, value } = info as { message?: unknown; value?: unknown }
          const shown = value === undefined ? '' : ` (value: ${value === null ? 'null' : JSON.stringify(value)})`
          return `${field}: ${String(message)}${shown}`
        }
        return `${field}: ${typeof info === 'string' ? info : JSON.stringify(info)}`
      })
      .join('; ')
  }
  return undefined
}
