const EARTH_RADIUS_M = 6_371_008.8
const DEFAULT_DASH_METERS = 5
const DEFAULT_GAP_METERS = 3.5

type LonLat = [number, number]

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180
}

function haversineMeters(lon1: number, lat1: number, lon2: number, lat2: number): number {
  const dLat = toRadians(lat2 - lat1)
  const dLon = toRadians(lon2 - lon1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLon / 2) ** 2
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(a))
}

function interpolateLonLat(from: LonLat, to: LonLat, t: number): LonLat {
  return [from[0] + (to[0] - from[0]) * t, from[1] + (to[1] - from[1]) * t]
}

export function dashLineStringCoordinates(
  coords: LonLat[],
  dashMeters = DEFAULT_DASH_METERS,
  gapMeters = DEFAULT_GAP_METERS
): LonLat[][] {
  if (coords.length < 2) return coords.length ? [coords] : []

  const segments: LonLat[][] = []
  let drawing = true
  let remaining = dashMeters
  let currentSegment: LonLat[] = []

  for (let i = 0; i < coords.length - 1; i += 1) {
    const start = coords[i]!
    const end = coords[i + 1]!
    const total = haversineMeters(start[0], start[1], end[0], end[1])
    if (total === 0) continue

    let walked = 0
    let cursor = start

    while (walked < total) {
      const step = Math.min(remaining, total - walked)
      const t = (walked + step) / total
      const next = interpolateLonLat(start, end, t)

      if (drawing) {
        if (currentSegment.length === 0) currentSegment.push(cursor)
        currentSegment.push(next)
      }

      walked += step
      remaining -= step
      cursor = next

      if (remaining <= 0) {
        if (drawing && currentSegment.length >= 2) {
          segments.push(currentSegment)
        }
        currentSegment = []
        drawing = !drawing
        remaining = drawing ? dashMeters : gapMeters
      }
    }
  }

  if (drawing && currentSegment.length >= 2) {
    segments.push(currentSegment)
  }

  return segments
}

export function dashLinearGeometry(
  geometry: object,
  dashMeters = DEFAULT_DASH_METERS,
  gapMeters = DEFAULT_GAP_METERS
): object {
  const geom = geometry as { type?: string; coordinates?: unknown }
  if (!geom.type || !Array.isArray(geom.coordinates)) return geometry

  if (geom.type === 'LineString') {
    const dashed = dashLineStringCoordinates(geom.coordinates as LonLat[], dashMeters, gapMeters)
    if (dashed.length === 0) return geometry
    if (dashed.length === 1) {
      return { type: 'LineString', coordinates: dashed[0] }
    }
    return { type: 'MultiLineString', coordinates: dashed }
  }

  if (geom.type === 'MultiLineString') {
    const allSegments = (geom.coordinates as LonLat[][]).flatMap((line) =>
      dashLineStringCoordinates(line, dashMeters, gapMeters)
    )
    if (allSegments.length === 0) return geometry
    return { type: 'MultiLineString', coordinates: allSegments }
  }

  return geometry
}
