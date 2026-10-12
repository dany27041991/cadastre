import { GEOM_PREFIX } from '@/features/territory-map-geoinsight/model/constants'

/**
 * Area ids are per-municipality. National/province viewports return many rows
 * with the same numeric id — vendor geom_id must include municipality_id.
 */
export function buildGreenAreaGeomId(
  areaId: number,
  municipalityId?: number | null
): string {
  if (municipalityId != null && Number.isFinite(municipalityId)) {
    return `${GEOM_PREFIX.greenArea}${municipalityId}_${areaId}`
  }
  return `${GEOM_PREFIX.greenArea}${areaId}`
}

/** Same collision class as areas: asset ids restart per municipality. */
export function buildGreenAssetGeomId(
  assetId: number,
  municipalityId?: number | null
): string {
  if (municipalityId != null && Number.isFinite(municipalityId)) {
    return `${GEOM_PREFIX.greenAsset}${municipalityId}_${assetId}`
  }
  return `${GEOM_PREFIX.greenAsset}${assetId}`
}

export function municipalityIdFromProperties(
  properties: Record<string, unknown> | null | undefined
): number | null {
  const raw = properties?.municipality_id ?? properties?.municipalityId
  const n = typeof raw === 'number' ? raw : Number(raw)
  return Number.isFinite(n) ? n : null
}
