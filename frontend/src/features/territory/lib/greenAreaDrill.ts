/**
 * Green-area hierarchy drill helpers (N-level parent_id / spatial expansion).
 */
import type { GeoJSONFeatureCollection } from '@/shared/types'
import type { GreenAreasParams } from '@/features/territory/api/greenAreaMap.api'
import { resolveFeatureId } from './featureIdentity'

/** Safety cap for N-level recursion (pathological / cyclic data). */
const MAX_GREEN_AREA_DEPTH = 32

export type FetchGreenAreasFn = (
  params: GreenAreasParams
) => Promise<GeoJSONFeatureCollection>

/** Removes the parent polygon from a contained-in-area API response (Geoinsight shared layer). */
export function filterGreenAreaChildren(
  geojson: GeoJSONFeatureCollection,
  parentAreaId: number
): GeoJSONFeatureCollection {
  return {
    ...geojson,
    features: (geojson.features ?? []).filter(
      (feature) => resolveFeatureId(feature.properties ?? {}, feature.id as number) !== parentAreaId
    ),
  }
}

/** Direct children of an area: prefer parent_id hierarchy, fall back to spatial containment. */
export async function fetchDirectGreenAreaChildren(
  fetchAreas: FetchGreenAreasFn,
  areaId: number,
  regionId: number,
  provinceId: number,
  municipalityId?: number
): Promise<GeoJSONFeatureCollection> {
  // Prefer municipality-scoped spatial probe when known: parent_id without
  // municipality used to scan the whole region (slow / MinIO 500 under load).
  if (municipalityId != null && municipalityId > 0) {
    try {
      const byContained = await fetchAreas({
        regionId,
        provinceId,
        municipalityId,
        containedInAreaId: areaId,
      })
      const containedKids = filterGreenAreaChildren(byContained, areaId)
      if ((containedKids.features?.length ?? 0) > 0) return containedKids
    } catch {
      // fall through to parent_id
    }
  }
  try {
    const byParent = await fetchAreas({
      regionId,
      provinceId,
      parentId: areaId,
      ...(municipalityId != null && municipalityId > 0
        ? { municipalityId }
        : {}),
    })
    const children = filterGreenAreaChildren(byParent, areaId)
    if ((children.features?.length ?? 0) > 0) return children
  } catch {
    // fall through
  }
  if (municipalityId == null || municipalityId <= 0) {
    try {
      const byContained = await fetchAreas({
        regionId,
        provinceId,
        municipalityId,
        containedInAreaId: areaId,
      })
      return filterGreenAreaChildren(byContained, areaId)
    } catch {
      return { type: 'FeatureCollection', features: [] }
    }
  }
  return { type: 'FeatureCollection', features: [] }
}

/**
 * Recursively expand children until leaf areas (no further children).
 * Used by "Esplodi sottoaree" so one CTA reaches the deepest hierarchy level.
 */
export async function fetchDeepestGreenAreaChildren(
  fetchAreas: FetchGreenAreasFn,
  rootAreaId: number,
  regionId: number,
  provinceId: number,
  municipalityId?: number,
  maxDepth = MAX_GREEN_AREA_DEPTH
): Promise<GeoJSONFeatureCollection> {
  let current = await fetchDirectGreenAreaChildren(
    fetchAreas,
    rootAreaId,
    regionId,
    provinceId,
    municipalityId
  )
  if ((current.features?.length ?? 0) === 0) {
    return { type: 'FeatureCollection', features: [] }
  }

  for (let depth = 0; depth < maxDepth; depth++) {
    let expanded = false
    const expansions = await Promise.all(
      (current.features ?? []).map(async (feature) => {
        const id = resolveFeatureId(feature.properties ?? {}, feature.id as number)
        if (id == null) return [feature]
        const kids = await fetchDirectGreenAreaChildren(
          fetchAreas,
          id,
          regionId,
          provinceId,
          municipalityId
        )
        if ((kids.features?.length ?? 0) > 0) {
          expanded = true
          return kids.features
        }
        return [feature]
      })
    )
    current = {
      type: 'FeatureCollection',
      features: dedupeGreenAreaFeatures(expansions.flat()),
    }
    if (!expanded) break
  }

  return current
}

function dedupeGreenAreaFeatures(
  features: GeoJSONFeatureCollection['features']
): GeoJSONFeatureCollection['features'] {
  const seen = new Set<number>()
  const out: GeoJSONFeatureCollection['features'] = []
  for (const feature of features ?? []) {
    const id = resolveFeatureId(feature.properties ?? {}, feature.id as number)
    if (id != null) {
      if (seen.has(id)) continue
      seen.add(id)
    }
    out.push(feature)
  }
  return out
}

/** Areas for viewport companion: keep drill scope when greenAreaId is set. */
export async function fetchGreenAreasForDrillScope(
  fetchAreas: FetchGreenAreasFn,
  rootAreaId: number,
  regionId: number,
  provinceId: number,
  municipalityId?: number
): Promise<GeoJSONFeatureCollection> {
  const deepest = await fetchDeepestGreenAreaChildren(
    fetchAreas,
    rootAreaId,
    regionId,
    provinceId,
    municipalityId
  )
  if ((deepest.features?.length ?? 0) > 0) return deepest

  // Leaf selection: show the selected area polygon itself.
  try {
    const selfOrKids = await fetchAreas({
      regionId,
      provinceId,
      municipalityId,
      containedInAreaId: rootAreaId,
    })
    const self = (selfOrKids.features ?? []).filter(
      (feature) =>
        resolveFeatureId(feature.properties ?? {}, feature.id as number) === rootAreaId
    )
    if (self.length > 0) {
      return { type: 'FeatureCollection', features: self }
    }
  } catch {
    // fall through
  }
  return { type: 'FeatureCollection', features: [] }
}

/** True when the area has at least one direct child (CTA Esplodi). */
export async function areaHasGreenChildren(
  fetchAreas: FetchGreenAreasFn,
  areaId: number,
  regionId: number,
  provinceId: number,
  municipalityId?: number
): Promise<boolean> {
  const children = await fetchDirectGreenAreaChildren(
    fetchAreas,
    areaId,
    regionId,
    provinceId,
    municipalityId
  )
  return (children.features?.length ?? 0) > 0
}
