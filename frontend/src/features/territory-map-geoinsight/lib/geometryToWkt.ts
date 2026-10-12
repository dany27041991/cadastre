/**
 * Shared WKT conversion for Geoinsight geometry payloads.
 */
import WKT from 'terraformer-wkt-parser'

export function geometryToWkt(geometry: object): string | null {
  try {
    const wkt = WKT.convert(geometry as Parameters<typeof WKT.convert>[0])
    return typeof wkt === 'string' && wkt.length > 0 ? wkt : null
  } catch {
    return null
  }
}
