import { WEB_MERCATOR_SCALE_BASE } from '../lib/webMercatorConstants'

/**
 * Parse map zoom from Geoinsight getCenterAndScale result.
 */
export function parseZoomFromCenterScale(result: unknown): number | null {
  if (result == null || typeof result !== 'object') return null
  const record = result as Record<string, unknown>
  if (typeof record.zoom === 'number' && Number.isFinite(record.zoom)) return record.zoom
  if (typeof record.level === 'number' && Number.isFinite(record.level)) return record.level
  if (typeof record.scale === 'number' && record.scale > 0) {
    return Math.log2(WEB_MERCATOR_SCALE_BASE / record.scale)
  }
  return null
}
