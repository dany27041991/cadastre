/**
 * Server-side paginated, filtered and sorted table data for green areas and green assets.
 */
import { API_URL } from '@/shared/config/map'
import { authFetch } from '@/shared/lib/auth'

// ---------------------------------------------------------------------------
// Response shape from GET /green-assets/table and /green-areas/table
// ---------------------------------------------------------------------------
export interface GreenTablePage {
  data: Record<string, unknown>[]
  total: number
  page: number
  page_size: number
  total_pages: number
}

// ---------------------------------------------------------------------------
// Shared filter / pagination / sort params
// ---------------------------------------------------------------------------
export interface GreenTableParams {
  /** Page number (1-based). */
  page?: number
  /** Rows per page (1-500). */
  page_size?: number
  /** Column name to sort by. */
  sort_by?: string
  /** Sort direction. */
  sort_dir?: 'asc' | 'desc'
  /** Free-text search. */
  q?: string
  /** Arbitrary additional column filters (key=column, value=filter string). */
  [key: string]: string | number | undefined
}

// ---------------------------------------------------------------------------
// Server-side paginated fetch (/table endpoints)
// ---------------------------------------------------------------------------

function buildTableUrl(
  base: string,
  territoryQuery: string,
  params: GreenTableParams,
): string {
  const p = new URLSearchParams(territoryQuery)
  if (params.page != null) p.set('page', String(params.page))
  if (params.page_size != null) p.set('page_size', String(params.page_size))
  if (params.sort_by) p.set('sort_by', params.sort_by)
  if (params.sort_dir) p.set('sort_dir', params.sort_dir)
  if (params.q) p.set('q', params.q)
  const reserved = new Set(['page', 'page_size', 'sort_by', 'sort_dir', 'q'])
  for (const [k, v] of Object.entries(params)) {
    if (!reserved.has(k) && v != null && v !== '') p.set(k, String(v))
  }
  return `${base}?${p.toString()}`
}

export async function fetchGreenAssetsTablePaged(
  territoryQuery: string,
  params: GreenTableParams = {},
): Promise<GreenTablePage> {
  const url = buildTableUrl(`${API_URL}/api/territory/green-assets/table`, territoryQuery, params)
  const res = await authFetch(url)
  if (!res.ok) throw new Error(`green-assets/table ${res.status}`)
  return res.json() as Promise<GreenTablePage>
}

export async function fetchGreenAreasTablePaged(
  territoryQuery: string,
  params: GreenTableParams = {},
): Promise<GreenTablePage> {
  const url = buildTableUrl(`${API_URL}/api/territory/green-areas/table`, territoryQuery, params)
  const res = await authFetch(url)
  if (!res.ok) throw new Error(`green-areas/table ${res.status}`)
  return res.json() as Promise<GreenTablePage>
}
