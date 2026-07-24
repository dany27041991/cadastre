const GEOM_ID_PREFIX_PRIORITY: Record<string, number> = {
  GC_: 0,
  GA_: 1,
  GS_: 2,
  T_: 3,
}

function geomIdPriority(geomId: string): number {
  for (const [prefix, priority] of Object.entries(GEOM_ID_PREFIX_PRIORITY)) {
    if (geomId.startsWith(prefix)) return priority
  }
  return 99
}

/** Geoinsight click payload: FeatureCollection | Feature[] | single Feature. */
export function normalizeGeoJsonFeatures(input: unknown): unknown[] {
  if (Array.isArray(input)) return input
  if (input == null || typeof input !== 'object') return []

  const record = input as Record<string, unknown>
  if (record.type === 'FeatureCollection' && Array.isArray(record.features)) {
    return record.features
  }
  if (record.type === 'Feature') return [input]
  if (Array.isArray(record.features)) return record.features

  return []
}

/**
 * Picks the best geom_id from a drawn-geometry hit-test (temp features on map).
 * Prefers green areas/assets over territory when features overlap.
 */
export function extractGeomIdFromDrawnFeatures(features: unknown): string | null {
  return pickBestGeomIdForGreenDrill(features, null, [])?.geomId ?? null
}

export function listGeomIdsFromDrawnFeatures(features: unknown): string[] {
  const list = normalizeGeoJsonFeatures(features)
  const ids: string[] = []
  for (const feature of list) {
    const geomId = extractGeomIdFromFeatureInfo(feature)
    if (geomId) ids.push(geomId)
  }
  return ids
}

export interface GreenDrillPickContext {
  resolveGeomId: (geomId: string) => { geomId: string; id: number; layerKind: string; bbox: [number, number, number, number] | null } | undefined
  excludeAreaIds: number[]
}

function bboxArea(bbox: [number, number, number, number] | null): number {
  if (bbox == null) return Number.POSITIVE_INFINITY
  const [minX, minY, maxX, maxY] = bbox
  return Math.abs(maxX - minX) * Math.abs(maxY - minY)
}

/**
 * OpenLayers places parent outline on territory layer and children on green layer above.
 * Geoinsight shares one layer — when parent and child overlap, pick the smallest green
 * feature and skip breadcrumb parents already expanded.
 */
export function pickBestGeomIdForGreenDrill(
  features: unknown,
  context: GreenDrillPickContext | null,
  excludeAreaIds: number[]
): { geomId: string; candidates: string[]; pickedReason: string } | null {
  const geomIds = listGeomIdsFromDrawnFeatures(features)
  if (geomIds.length === 0) return null

  const exclude = new Set(excludeAreaIds)
  const excludeFromContext = new Set(context?.excludeAreaIds ?? [])
  for (const id of excludeFromContext) exclude.add(id)

  type Candidate = {
    geomId: string
    id: number
    layerKind: string
    area: number
  }

  const candidates: Candidate[] = []
  for (const rawGeomId of geomIds) {
    const entry = context?.resolveGeomId(rawGeomId)
    if (!entry) continue
    candidates.push({
      geomId: entry.geomId,
      id: entry.id,
      layerKind: entry.layerKind,
      area: bboxArea(entry.bbox),
    })
  }

  const clusterCandidates = candidates.filter((c) => c.layerKind === 'cluster')
  if (clusterCandidates.length > 0) {
    clusterCandidates.sort((a, b) => a.area - b.area)
    return {
      geomId: clusterCandidates[0].geomId,
      candidates: geomIds,
      pickedReason: 'cluster-drill',
    }
  }

  const rawClusterIds = geomIds.filter((geomId) => geomId.startsWith('GC_'))
  if (rawClusterIds.length > 0) {
    return {
      geomId: rawClusterIds[0],
      candidates: geomIds,
      pickedReason: 'raw-gc-prefix',
    }
  }

  const greenCandidates = candidates.filter(
    (c) => c.layerKind === 'green_area' && !exclude.has(c.id)
  )
  if (greenCandidates.length > 0) {
    greenCandidates.sort((a, b) => a.area - b.area)
    return {
      geomId: greenCandidates[0].geomId,
      candidates: geomIds,
      pickedReason: 'smallest-green-not-in-breadcrumb',
    }
  }

  const rawGreenIds = geomIds.filter((geomId) => geomId.startsWith('GA_'))
  if (rawGreenIds.length > 0) {
    const rawCandidates = rawGreenIds
      .map((geomId) => {
        const entry = context?.resolveGeomId(geomId)
        const id = entry?.id ?? Number.parseInt(geomId.slice(3), 10)
        if (!Number.isFinite(id)) return null
        return {
          geomId: entry?.geomId ?? geomId,
          id,
          area: entry ? bboxArea(entry.bbox) : Number.POSITIVE_INFINITY,
        }
      })
      .filter((item): item is NonNullable<typeof item> => item != null && !exclude.has(item.id))
    if (rawCandidates.length > 0) {
      rawCandidates.sort((a, b) => a.area - b.area)
      return {
        geomId: rawCandidates[0].geomId,
        candidates: geomIds,
        pickedReason: 'raw-ga-prefix-fallback',
      }
    }
  }

  let best: string | null = null
  let bestPriority = 99
  for (const geomId of geomIds) {
    const priority = geomIdPriority(geomId)
    if (priority < bestPriority) {
      best = geomId
      bestPriority = priority
    }
  }
  if (!best) return null
  return { geomId: best, candidates: geomIds, pickedReason: 'prefix-priority-fallback' }
}

/**
 * Parses Geoinsight onGetFeatureInfo / onDrawnGeometryInfo payloads into geom_id.
 */
export function extractGeomIdFromFeatureInfo(event: unknown): string | null {
  if (event == null || typeof event !== 'object') return null

  const direct = readGeomId(event)
  if (direct) return direct

  const record = event as Record<string, unknown>

  if (record.type === 'FeatureCollection' || record.type === 'Feature') {
    const fromGeoJson = extractGeomIdFromDrawnFeatures(event)
    if (fromGeoJson) return fromGeoJson
  }

  const detail = record.detail
  if (Array.isArray(detail)) {
    for (const item of detail) {
      const id = extractGeomIdFromFeatureInfo(item)
      if (id) return id
    }
  }

  if (detail && typeof detail === 'object') {
    const fromDetail = readGeomId(detail as object)
    if (fromDetail) return fromDetail
    const fromDetailFeatures = extractGeomIdFromDrawnFeatures(
      (detail as Record<string, unknown>).features ?? detail
    )
    if (fromDetailFeatures) return fromDetailFeatures
  }

  const fromFeatures = extractGeomIdFromDrawnFeatures(record.features ?? event)
  if (fromFeatures) return fromFeatures

  return null
}

function readGeomId(source: object): string | null {
  const record = source as Record<string, unknown>
  const candidates = [
    record.geom_id,
    record.geomId,
    record.id,
    (record.properties as Record<string, unknown> | undefined)?.geom_id,
    (record.properties as Record<string, unknown> | undefined)?.id,
  ]
  for (const value of candidates) {
    const geomId = coerceGeomId(value)
    if (geomId) return geomId
  }
  return null
}

function coerceGeomId(value: unknown): string | null {
  if (typeof value === 'string' && value.length > 0) return value
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  return null
}
