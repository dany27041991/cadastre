/**
 * Lon/lat hit-test for GeoJSON geometries (EPSG:4326).
 * Used by map hover when Geoinsight does not expose feature-at-pixel on mousemove.
 */

export type GeometryHitKind = 'point' | 'line' | 'surface' | 'unknown'

/** Degrees — ~130 m at mid latitudes; matches small screen point markers. */
export const HIT_PAD_POINT_DEG = 0.0012
/** Degrees — line stroke tolerance (~50 m). */
export const HIT_PAD_LINE_DEG = 0.00045
/** Degrees — bbox coarse filter for surfaces / green areas. */
export const HIT_PAD_SURFACE_DEG = 0.00015

type LonLat = [number, number]

export function geometryHitKind(geometry: object): GeometryHitKind {
  const type = (geometry as { type?: string }).type
  switch (type) {
    case 'Point':
    case 'MultiPoint':
      return 'point'
    case 'LineString':
    case 'MultiLineString':
      return 'line'
    case 'Polygon':
    case 'MultiPolygon':
      return 'surface'
    default:
      return 'unknown'
  }
}

export function hitPadForKind(kind: GeometryHitKind): number {
  switch (kind) {
    case 'point':
      return HIT_PAD_POINT_DEG
    case 'line':
      return HIT_PAD_LINE_DEG
    case 'surface':
      return HIT_PAD_SURFACE_DEG
    default:
      return HIT_PAD_POINT_DEG
  }
}

function distSq(ax: number, ay: number, bx: number, by: number): number {
  const dx = ax - bx
  const dy = ay - by
  return dx * dx + dy * dy
}

/** Squared distance from point P to segment AB. */
function distSqToSegment(
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number
): number {
  const abx = bx - ax
  const aby = by - ay
  const lenSq = abx * abx + aby * aby
  if (lenSq === 0) return distSq(px, py, ax, ay)
  let t = ((px - ax) * abx + (py - ay) * aby) / lenSq
  t = Math.max(0, Math.min(1, t))
  return distSq(px, py, ax + t * abx, ay + t * aby)
}

function pointNearPoint(lon: number, lat: number, coord: LonLat, pad: number): boolean {
  return distSq(lon, lat, coord[0], coord[1]) <= pad * pad
}

function pointNearLineString(
  lon: number,
  lat: number,
  coords: LonLat[],
  pad: number
): boolean {
  const padSq = pad * pad
  for (let i = 0; i < coords.length - 1; i += 1) {
    const a = coords[i]
    const b = coords[i + 1]
    if (distSqToSegment(lon, lat, a[0], a[1], b[0], b[1]) <= padSq) return true
  }
  return false
}

/** Ray-casting point-in-ring (lon/lat treated as planar for local hit-tests). */
function pointInRing(lon: number, lat: number, ring: LonLat[]): boolean {
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
    const xi = ring[i][0]
    const yi = ring[i][1]
    const xj = ring[j][0]
    const yj = ring[j][1]
    const intersect =
      yi > lat !== yj > lat &&
      lon < ((xj - xi) * (lat - yi)) / (yj - yi + Number.EPSILON) + xi
    if (intersect) inside = !inside
  }
  return inside
}

function pointInPolygon(lon: number, lat: number, rings: LonLat[][]): boolean {
  if (!rings.length) return false
  if (!pointInRing(lon, lat, rings[0])) return false
  for (let h = 1; h < rings.length; h += 1) {
    if (pointInRing(lon, lat, rings[h])) return false
  }
  return true
}

/**
 * True when (lon, lat) hits the geometry.
 * Points/lines use a degree pad; polygons use point-in-polygon (exterior − holes).
 */
export function lonLatHitsGeometry(
  geometry: object,
  lon: number,
  lat: number,
  padOverride?: number
): boolean {
  const geom = geometry as { type?: string; coordinates?: unknown }
  if (!geom.type || geom.coordinates == null) return false
  const kind = geometryHitKind(geometry)
  const pad = padOverride ?? hitPadForKind(kind)

  switch (geom.type) {
    case 'Point':
      return pointNearPoint(lon, lat, geom.coordinates as LonLat, pad)
    case 'MultiPoint':
      return (geom.coordinates as LonLat[]).some((c) => pointNearPoint(lon, lat, c, pad))
    case 'LineString':
      return pointNearLineString(lon, lat, geom.coordinates as LonLat[], pad)
    case 'MultiLineString':
      return (geom.coordinates as LonLat[][]).some((line) =>
        pointNearLineString(lon, lat, line, pad)
      )
    case 'Polygon':
      return pointInPolygon(lon, lat, geom.coordinates as LonLat[][])
    case 'MultiPolygon':
      return (geom.coordinates as LonLat[][][]).some((poly) => pointInPolygon(lon, lat, poly))
    default:
      return false
  }
}
