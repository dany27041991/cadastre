import { getResolutionForZoomWebMercator } from '@/features/territory/lib/greenAssetClusterCore'

const METERS_PER_DEGREE_LAT = 111_320
const CLUSTER_COUNT_K_THRESHOLD = 999

type LonLat = [number, number]

export function formatClusterCount(count: number): string {
  return count > CLUSTER_COUNT_K_THRESHOLD
    ? `${(count / 1000).toFixed(1)}k`
    : String(count)
}

/** Unique geom_id whose visible label is the member count (Geoinsight renders text before \u200B). */
export function clusterLabelGeomId(memberCount: number, suffix: string | number): string {
  return `${formatClusterCount(memberCount)}\u200B${suffix}`
}

/** Screen radius (px) at reference counts — proportional via normalized log scale. */
export const CLUSTER_RADIUS_MIN_PX = 10
export const CLUSTER_RADIUS_MAX_PX = 56
/** Reference count mapped to CLUSTER_RADIUS_MAX_PX. */
export const CLUSTER_RADIUS_REFERENCE_COUNT = 5000

/** Cluster circle radius on screen (px) — grows with member count (small → large). */
export function clusterCircleSizePx(memberCount: number): number {
  const count = Math.max(2, memberCount)
  const minLog = Math.log(2)
  const maxLog = Math.log(CLUSTER_RADIUS_REFERENCE_COUNT)
  const t = Math.min(1, Math.max(0, (Math.log(count) - minLog) / (maxLog - minLog)))
  return CLUSTER_RADIUS_MIN_PX + t * (CLUSTER_RADIUS_MAX_PX - CLUSTER_RADIUS_MIN_PX)
}

/** Ground radius (m) so the circle keeps clusterCircleSizePx at the given map zoom. */
export function clusterRadiusMeters(
  memberCount: number,
  mapZoom: number,
  latitude = 41.9
): number {
  const resolution = getResolutionForZoomWebMercator(mapZoom, latitude)
  return clusterCircleSizePx(memberCount) * resolution
}

/** Polygon segments for cluster circles — 16 ≈ half WKT vs 32, same screen size. */
export const CLUSTER_POLYGON_SEGMENTS = 16

export function circlePolygonFromLonLat(
  lon: number,
  lat: number,
  radiusMeters: number,
  segments = CLUSTER_POLYGON_SEGMENTS
): { type: 'Polygon'; coordinates: LonLat[][] } {
  const latRad = (lat * Math.PI) / 180
  const metersPerDegreeLon = METERS_PER_DEGREE_LAT * Math.cos(latRad)
  const ring: LonLat[] = []

  for (let i = 0; i <= segments; i += 1) {
    const angle = (2 * Math.PI * i) / segments
    const dx = (radiusMeters * Math.cos(angle)) / metersPerDegreeLon
    const dy = (radiusMeters * Math.sin(angle)) / METERS_PER_DEGREE_LAT
    ring.push([lon + dx, lat + dy])
  }

  return { type: 'Polygon', coordinates: [ring] }
}

export function clusterItemToCirclePolygon(
  item: { memberCount: number; geometry: object },
  mapZoom: number
): object {
  const geom = item.geometry as { type?: string; coordinates?: LonLat }
  if (geom.type !== 'Point' || !Array.isArray(geom.coordinates)) return item.geometry

  const [lon, lat] = geom.coordinates
  if (!Number.isFinite(lon) || !Number.isFinite(lat)) return item.geometry

  return circlePolygonFromLonLat(lon, lat, clusterRadiusMeters(item.memberCount, mapZoom, lat))
}
