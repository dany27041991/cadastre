import { getResolutionForZoomWebMercator } from '@/features/territory/lib/greenAssetClusterCore'
import { parseZoomFromCenterScale } from '../model/parseMapZoom'

const DEFAULT_VIEWPORT_PX = { width: 1280, height: 800 }
const WEB_MERCATOR_HALF = 20_037_508.34

function isWebMercatorEpsg(epsg: string | undefined): boolean {
  if (!epsg) return false
  const normalized = epsg.toUpperCase().replace('EPSG:', '')
  return normalized === '3857' || normalized === '900913'
}

function mercatorToLonLat(x: number, y: number): [number, number] {
  const lon = (x * 180) / WEB_MERCATOR_HALF
  const lat =
    (180 / Math.PI) * (2 * Math.atan(Math.exp((y * Math.PI) / WEB_MERCATOR_HALF)) - Math.PI / 2)
  return [lon, lat]
}

function centerToWgs84(center: number[], epsg: string | undefined): [number, number] | null {
  const x = center[0]
  const y = center[1]
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null
  if (isWebMercatorEpsg(epsg)) return mercatorToLonLat(x, y)
  return [x, y]
}

export function readMapViewportPx(): { width: number; height: number } {
  if (typeof document === 'undefined') return DEFAULT_VIEWPORT_PX
  const el =
    document.querySelector('.ol-viewport') ??
    document.querySelector('[class*="map"]') ??
    document.body
  const rect = el.getBoundingClientRect()
  if (rect.width > 0 && rect.height > 0) {
    return { width: rect.width, height: rect.height }
  }
  return DEFAULT_VIEWPORT_PX
}

const VIEWPORT_PADDING = 1.5
/**
 * At deep zoom every mounted single asset weighs on each vendor render frame
 * (debug logs: 1500-2600 singles at zoom 16.85-17.85, apply timers 300-650ms late).
 * A tighter pre-load margin keeps frames lighter where density is highest.
 */
const VIEWPORT_PADDING_DEEP_ZOOM = 1.3
const DEEP_ZOOM_THRESHOLD = 16.5
/**
 * At the last zoom level (raw assets, ~19.17) keep the fetch margin tight: the
 * vendor (OpenLayers canvas) redraws every mounted vector feature on each pan
 * frame, and >1000 mounted features measured 460-810ms render frames (debug
 * session 4fe799, `animationDelay_`). The pan buffer against edge pop-in is
 * provided by additive mounting (exiting features stay mounted until the idle
 * prune), not by over-fetching.
 */
const VIEWPORT_PADDING_MAX_ZOOM = 1.15
const MAX_ZOOM_THRESHOLD = 19

/**
 * Approximate WGS84 bbox [minLon, minLat, maxLon, maxLat] for the current map view.
 * Padding 1.5 pre-loads 25% beyond each edge (1.3 -> 15% at deep zoom); 1.85 mounted
 * ~2700 features at deep zoom and froze the vendor render during zoom animations.
 */
export function viewportBboxFromMapStatus(
  status: unknown,
  padding?: number
): [number, number, number, number] | null {
  if (status == null || typeof status !== 'object') return null
  const record = status as { center?: number[]; epsg?: string }
  const center = record.center
  if (!center || center.length < 2) return null
  const zoom = parseZoomFromCenterScale(status)
  if (zoom == null) return null
  const effectivePadding =
    padding ??
    (zoom >= MAX_ZOOM_THRESHOLD
      ? VIEWPORT_PADDING_MAX_ZOOM
      : zoom >= DEEP_ZOOM_THRESHOLD
        ? VIEWPORT_PADDING_DEEP_ZOOM
        : VIEWPORT_PADDING)

  const wgs84Center = centerToWgs84(center, record.epsg)
  if (wgs84Center == null) return null
  const [lon, lat] = wgs84Center
  const { width, height } = readMapViewportPx()
  const resolution = getResolutionForZoomWebMercator(zoom, lat)
  const halfWidthM = (width / 2) * resolution * effectivePadding
  const halfHeightM = (height / 2) * resolution * effectivePadding
  const cosLat = Math.max(0.2, Math.cos((lat * Math.PI) / 180))
  const deltaLon = halfWidthM / (111_320 * cosLat)
  const deltaLat = halfHeightM / 111_320
  return [lon - deltaLon, lat - deltaLat, lon + deltaLon, lat + deltaLat]
}

/** Fraction of viewport width/height the center moved between two bboxes. */
export function viewportBboxShiftRatio(
  prev: [number, number, number, number],
  next: [number, number, number, number]
): number {
  const prevCx = (prev[0] + prev[2]) / 2
  const prevCy = (prev[1] + prev[3]) / 2
  const nextCx = (next[0] + next[2]) / 2
  const nextCy = (next[1] + next[3]) / 2
  const width = Math.max(1e-9, prev[2] - prev[0])
  const height = Math.max(1e-9, prev[3] - prev[1])
  const dx = Math.abs(nextCx - prevCx) / width
  const dy = Math.abs(nextCy - prevCy) / height
  return Math.max(dx, dy)
}

export function viewportBboxMovedEnough(
  prev: [number, number, number, number],
  next: [number, number, number, number],
  // The 0.08 threshold triggered a fetch+decode+mount cycle on nearly every
  // micro-drag; the cumulative allocation churn caused 1-2s Firefox major GC
  // pauses that froze directional panning (debug session 4fe799). With the
  // padded bbox pre-loading beyond the screen edges, refreshing only after a
  // fifth of the viewport keeps edges covered while cutting cycle frequency.
  minShiftRatio = 0.2
): boolean {
  if (viewportBboxShiftRatio(prev, next) >= minShiftRatio) return true
  // Zoom +/- keeps the center fixed; only the extent grows/shrinks. Treat a
  // meaningful scale change as a view change so cluster refetch is not skipped.
  const prevArea = Math.max(1e-18, (prev[2] - prev[0]) * (prev[3] - prev[1]))
  const nextArea = Math.max(1e-18, (next[2] - next[0]) * (next[3] - next[1]))
  const scaleRatio = nextArea / prevArea
  return scaleRatio >= 1.35 || scaleRatio <= 1 / 1.35
}

