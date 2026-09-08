/**
 * Curated green area / asset detail for map panel.
 * GET /api/territory/green-assets/{id} | /green-areas/{id}
 */
import { API_URL } from '@/shared/config/map'
import { authFetch } from '@/shared/lib/auth'
import {
  GREEN_DETAIL_KIND_AREA,
  GREEN_DETAIL_KIND_ASSET,
} from '../model/constants'

export type GreenDetailKind =
  | typeof GREEN_DETAIL_KIND_AREA
  | typeof GREEN_DETAIL_KIND_ASSET

export { GREEN_DETAIL_KIND_AREA, GREEN_DETAIL_KIND_ASSET }

export interface GreenDetailSummary {
  primaryLabel: string
  /** From attribute_types (e.g. Albero / Siepe) — asset summary field label. */
  attributeTypeLabel?: string | null
  regionLabel?: string | null
  municipalityLabel?: string | null
  provinceLabel?: string | null
  regionId?: number | null
  provinceId?: number | null
  municipalityId?: number | null
}

export interface GreenDetailMetadataItem {
  key: string
  value: string
}

export interface GreenDetailDto {
  kind: GreenDetailKind
  id: number
  summary: GreenDetailSummary
  metadata: GreenDetailMetadataItem[]
  /** WGS84 [minLon, minLat, maxLon, maxLat] when available — table→detail framing. */
  bbox?: [number, number, number, number] | null
  /** True GeoJSON geometry for red selection shape (not bbox rectangle). */
  geometry?: object | null
}

export type GreenDetailParams = {
  id: number
  regionId: number
  provinceId: number
  dateFrom?: string
  dateTo?: string
}

function buildDetailUrl(kind: GreenDetailKind, params: GreenDetailParams): string {
  const base =
    kind === GREEN_DETAIL_KIND_ASSET
      ? `${API_URL}/api/territory/green-assets/${params.id}`
      : `${API_URL}/api/territory/green-areas/${params.id}`
  const q = new URLSearchParams({
    region_id: String(params.regionId),
    province_id: String(params.provinceId),
  })
  if (params.dateFrom) q.set('date_from', params.dateFrom)
  if (params.dateTo) q.set('date_to', params.dateTo)
  return `${base}?${q.toString()}`
}

export class GreenDetailHttpError extends Error {
  readonly status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = 'GreenDetailHttpError'
    this.status = status
  }
}

/** Accept camelCase or snake_case summary from BE. */
function normalizeDetail(raw: Record<string, unknown>): GreenDetailDto {
  const summaryRaw = (raw.summary ?? {}) as Record<string, unknown>
  const primaryLabel = String(
    summaryRaw.primaryLabel ?? summaryRaw.primary_label ?? ''
  )
  const attributeTypeLabel =
    (summaryRaw.attributeTypeLabel as string | null | undefined) ??
    (summaryRaw.attribute_type_label as string | null | undefined) ??
    null
  const regionLabel =
    (summaryRaw.regionLabel as string | null | undefined) ??
    (summaryRaw.region_label as string | null | undefined) ??
    null
  const municipalityLabel =
    (summaryRaw.municipalityLabel as string | null | undefined) ??
    (summaryRaw.municipality_label as string | null | undefined) ??
    null
  const provinceLabel =
    (summaryRaw.provinceLabel as string | null | undefined) ??
    (summaryRaw.province_label as string | null | undefined) ??
    null
  const toId = (v: unknown): number | null => {
    const n = Number(v)
    return Number.isFinite(n) && n > 0 ? n : null
  }
  const regionId =
    toId(summaryRaw.regionId) ?? toId(summaryRaw.region_id)
  const provinceId =
    toId(summaryRaw.provinceId) ?? toId(summaryRaw.province_id)
  const municipalityId =
    toId(summaryRaw.municipalityId) ?? toId(summaryRaw.municipality_id)
  const metadata = Array.isArray(raw.metadata)
    ? (raw.metadata as GreenDetailMetadataItem[])
    : []
  const bboxRaw = raw.bbox
  let bbox: [number, number, number, number] | null = null
  if (Array.isArray(bboxRaw) && bboxRaw.length === 4) {
    const nums = bboxRaw.map(Number)
    if (nums.every((n) => Number.isFinite(n))) {
      bbox = [nums[0]!, nums[1]!, nums[2]!, nums[3]!]
    }
  }
  const geometryRaw = raw.geometry
  const geometry =
    geometryRaw != null &&
    typeof geometryRaw === 'object' &&
    !Array.isArray(geometryRaw) &&
    typeof (geometryRaw as { type?: unknown }).type === 'string'
      ? (geometryRaw as object)
      : null
  return {
    kind: raw.kind as GreenDetailKind,
    id: Number(raw.id),
    summary: {
      primaryLabel,
      attributeTypeLabel,
      regionLabel,
      municipalityLabel,
      provinceLabel,
      regionId,
      provinceId,
      municipalityId,
    },
    metadata,
    bbox,
    geometry,
  }
}

export async function fetchGreenDetail(
  kind: GreenDetailKind,
  params: GreenDetailParams,
  signal?: AbortSignal
): Promise<GreenDetailDto> {
  const res = await authFetch(buildDetailUrl(kind, params), { signal })
  if (!res.ok) {
    throw new GreenDetailHttpError(res.status, `green-detail ${kind} ${res.status}`)
  }
  const json = (await res.json()) as Record<string, unknown>
  return normalizeDetail(json)
}
