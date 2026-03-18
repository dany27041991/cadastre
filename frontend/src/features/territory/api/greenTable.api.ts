/**
 * JSON table data for green areas and green assets.
 */
import { API_URL } from '@/shared/config/map'
import { authFetch } from '@/shared/lib/auth'

export async function fetchGreenAreasTable(query: string): Promise<Record<string, unknown>[]> {
  const res = await authFetch(`${API_URL}/api/territory/green-areas/filter?${query}`)
  if (!res.ok) throw new Error(`green-areas/filter ${res.status}`)
  return res.json() as Promise<Record<string, unknown>[]>
}

export async function fetchGreenAssetsTable(query: string): Promise<Record<string, unknown>[]> {
  const res = await authFetch(`${API_URL}/api/territory/green-assets/filter?${query}`)
  if (!res.ok) throw new Error(`green-assets/filter ${res.status}`)
  return res.json() as Promise<Record<string, unknown>[]>
}
