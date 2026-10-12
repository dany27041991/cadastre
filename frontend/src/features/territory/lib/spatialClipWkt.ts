/**
 * User-drawn map clip → EPSG:4326 POLYGON WKT for viewport/table `clip_wkt`.
 */
import WKT from 'terraformer-wkt-parser'
import { mercatorToLonLat } from '@/features/territory-map-geoinsight/model/pointerCoords'

export const CLIP_WKT_MAX_VERTICES = 256

export type SpatialClipPolygon = {
  type: 'Polygon'
  coordinates: number[][][]
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === 'object'
}

function closeRing(ring: number[][]): number[][] {
  if (ring.length === 0) return ring
  const first = ring[0]
  const last = ring[ring.length - 1]
  if (first[0] === last[0] && first[1] === last[1]) return ring
  return [...ring, [first[0], first[1]]]
}

function capRing(ring: number[][], maxVertices: number): number[][] {
  const open = ring.length > 1 ? ring.slice(0, -1) : ring
  if (open.length <= maxVertices) return closeRing(open)
  const step = (open.length - 1) / (maxVertices - 1)
  const sampled: number[][] = []
  for (let i = 0; i < maxVertices - 1; i += 1) {
    sampled.push(open[Math.round(i * step)])
  }
  return closeRing(sampled)
}

function asPosition(value: unknown): number[] | null {
  if (!Array.isArray(value) || value.length < 2) return null
  const lon = Number(value[0])
  const lat = Number(value[1])
  if (!Number.isFinite(lon) || !Number.isFinite(lat)) return null
  return [lon, lat]
}

function isWgs84Epsg(epsg: string | undefined): boolean {
  if (!epsg) return false
  const n = epsg.trim().toUpperCase().replace('EPSG:', '')
  return n === '4326'
}

function isMercatorEpsg(epsg: string | undefined): boolean {
  if (!epsg) return false
  const n = epsg.trim().toUpperCase().replace('EPSG:', '')
  return n === '3857' || n === '900913'
}

function looksLikeMercator(polygon: SpatialClipPolygon): boolean {
  const ring = polygon.coordinates[0] ?? []
  return ring.some(([x, y]) => Math.abs(x) > 180 || Math.abs(y) > 90)
}

function projectRingToWgs84(ring: number[][]): number[][] {
  return ring.map(([x, y]) => {
    const [lon, lat] = mercatorToLonLat(x, y)
    return [lon, lat]
  })
}

export function projectPolygonToWgs84(
  polygon: SpatialClipPolygon,
  epsg?: string
): SpatialClipPolygon {
  const mustProject = isMercatorEpsg(epsg) || (!isWgs84Epsg(epsg) && looksLikeMercator(polygon))
  if (!mustProject) return polygon
  return {
    type: 'Polygon',
    coordinates: [closeRing(projectRingToWgs84(polygon.coordinates[0] ?? []))],
  }
}

export function normalizePolygon(geom: unknown): SpatialClipPolygon | null {
  if (!isRecord(geom)) return null
  if (geom.type === 'Feature') return normalizePolygon(geom.geometry)
  if (geom.type === 'MultiPolygon' && Array.isArray(geom.coordinates)) {
    const first = geom.coordinates[0]
    return normalizePolygon({ type: 'Polygon', coordinates: first })
  }
  if (geom.type !== 'Polygon' || !Array.isArray(geom.coordinates)) return null
  const ringRaw = geom.coordinates[0]
  if (!Array.isArray(ringRaw)) return null
  const ring: number[][] = []
  for (const pos of ringRaw) {
    const xy = asPosition(pos)
    if (!xy) return null
    ring.push(xy)
  }
  const closed = closeRing(ring)
  if (closed.length < 4) return null
  const first = closed[0]
  const hasExtent = closed.some((p) => p[0] !== first[0] || p[1] !== first[1])
  if (!hasExtent) return null
  return { type: 'Polygon', coordinates: [closed] }
}

function readClipEpsg(clip: Record<string, unknown>, fallbackEpsg?: string): string | undefined {
  const raw = clip.epsg ?? clip.EPSG
  if (typeof raw === 'string' && raw.trim()) return raw.trim()
  if (typeof raw === 'number') return `EPSG:${raw}`
  return fallbackEpsg
}

/** Last WKT clip from Geoinsight simpledraw `current` list. */
export function clipFromSimpleDrawCurrent(current: unknown): Record<string, unknown> | null {
  if (!Array.isArray(current) || current.length === 0) return null
  const last = current[current.length - 1]
  if (!isRecord(last)) return null
  if (isRecord(last.geometry)) return last.geometry
  return last
}

/** Geoinsight `simpleFeatureDrawn` CustomEvent → last WKT clip payload. */
export function clipFromSimpleFeatureDrawn(event: unknown): Record<string, unknown> | null {
  if (typeof event !== 'object' || event == null || !('detail' in event)) return null
  const detail = (event as CustomEvent).detail
  const payload = Array.isArray(detail) ? detail[0] : detail
  if (!isRecord(payload)) return null
  return clipFromSimpleDrawCurrent(payload.current)
}

/** Geoinsight `onGeometryDrawn` clip (WKT payload or GeoJSON) → WGS84 polygon. */
export function clipPayloadToPolygon(
  clip: unknown,
  mapEpsg?: string
): SpatialClipPolygon | null {
  if (!isRecord(clip)) return null
  const epsg = readClipEpsg(clip, mapEpsg)
  let parsed: SpatialClipPolygon | null = null
  if (clip.type === 'WKT' && typeof clip.data === 'string') {
    try {
      parsed = normalizePolygon(WKT.parse(clip.data))
    } catch {
      parsed = null
    }
  } else if (
    typeof clip.data === 'string' &&
    clip.data.trim().toUpperCase().startsWith('POLYGON')
  ) {
    try {
      parsed = normalizePolygon(WKT.parse(clip.data))
    } catch {
      parsed = null
    }
  } else {
    parsed = normalizePolygon(clip)
  }
  if (parsed == null) return null
  return projectPolygonToWgs84(parsed, epsg)
}

export function polygonToWkt(
  polygon: SpatialClipPolygon,
  maxVertices = CLIP_WKT_MAX_VERTICES
): string {
  const ring = capRing(polygon.coordinates[0] ?? [], maxVertices)
  if (ring.length < 4) {
    throw new Error('invalid polygon')
  }
  return WKT.convert({ type: 'Polygon', coordinates: [ring] })
}

export function bboxFromPolygon(
  polygon: SpatialClipPolygon
): [number, number, number, number] {
  const ring = polygon.coordinates[0] ?? []
  let minLon = Infinity
  let minLat = Infinity
  let maxLon = -Infinity
  let maxLat = -Infinity
  for (const pos of ring) {
    minLon = Math.min(minLon, pos[0])
    minLat = Math.min(minLat, pos[1])
    maxLon = Math.max(maxLon, pos[0])
    maxLat = Math.max(maxLat, pos[1])
  }
  return [minLon, minLat, maxLon, maxLat]
}
