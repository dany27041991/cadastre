/** Convert Web Mercator metres to WGS84 lon/lat. */
const ORIGIN_SHIFT = 20037508.342789244

export function mercatorToLonLat(x: number, y: number): [number, number] {
  const lon = (x / ORIGIN_SHIFT) * 180
  let lat = (y / ORIGIN_SHIFT) * 180
  lat =
    (180 / Math.PI) *
    (2 * Math.atan(Math.exp((lat * Math.PI) / 180)) - Math.PI / 2)
  return [lon, lat]
}

function parseCoordPair(coords: unknown): [number, number] | null {
  if (Array.isArray(coords) && coords.length >= 2) {
    const x = Number(coords[0])
    const y = Number(coords[1])
    if (Number.isFinite(x) && Number.isFinite(y)) return [x, y]
    return null
  }
  if (typeof coords === 'string') {
    const parts = coords.trim().split(/[\s,;]+/)
    if (parts.length < 2) return null
    const x = Number(parts[0])
    const y = Number(parts[1])
    if (Number.isFinite(x) && Number.isFinite(y)) return [x, y]
  }
  return null
}

/** Normalize map pointer coords to EPSG:4326 [lon, lat]. */
export function pointerCoordsToLonLat(
  epsg: string,
  coords: unknown
): [number, number] | null {
  const pair = parseCoordPair(coords)
  if (!pair) return null
  const [x, y] = pair
  if (epsg === 'EPSG:4326' || epsg === '4326') return [x, y]
  if (epsg === 'EPSG:3857' || epsg === '3857') return mercatorToLonLat(x, y)
  // Default map CRS in SIV store is Web Mercator.
  return mercatorToLonLat(x, y)
}
