import { requestJson } from '../http'
import type { LicenseGateLicense } from '../types'
import { normalizeLicenseListResponse } from './normalize-list-response'

export async function listAllLicenses(fetchImplementation: typeof fetch, baseUrl: string, apiKey: string) {
  const take = 100
  let skip = 0
  let totalCount: number | undefined
  const all: LicenseGateLicense[] = []

  while (true) {
    const payload = await requestJson<unknown>(fetchImplementation, baseUrl, apiKey, `/admin/licenses?take=${take}&skip=${skip}`)
    const { licenses, count } = normalizeLicenseListResponse(payload)
    all.push(...licenses)

    if (totalCount === undefined && typeof count === 'number') totalCount = count
    if (licenses.length < take) break

    skip += licenses.length
    if (totalCount !== undefined && skip >= totalCount) break
  }

  return all
}
