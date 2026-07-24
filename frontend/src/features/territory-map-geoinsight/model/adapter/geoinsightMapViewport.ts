import { useGeoinsightStore } from '@/app/store/useGeoinsightStore'
import { parseZoomFromCenterScale } from '../parseMapZoom'
import {
  bboxCenter,
  bufferBbox,
  isValidBbox,
  nextClusterDrillZoom,
  VIEW_MAX_ZOOM,
  webMercatorScaleForZoom,
} from '../mapZoomUtils'
import { GEOINSIGHT_EPSG_WGS84 } from '../constants'
import { readMapViewportPx } from '../../lib/mapViewportBbox'
import {
  getGeoinsightMapId,
  getGeoinsightRef,
  runGeoinsightOrQueue,
  type GeoinsightMapRuntimeHost,
} from './geoinsightMapRuntime'

const ZOOM_CLAMP_DELAY_MS = 420

export function syncGeoinsightZoomFromMap(): void {
  const ref = getGeoinsightRef()
  if (!ref?.getCenterAndScale) return
  const zoom = parseZoomFromCenterScale(ref.getCenterAndScale(getGeoinsightMapId()))
  if (zoom != null) useGeoinsightStore.getState().setMapZoom(zoom)
}

export function zoomGeoinsightToBbox(
  host: GeoinsightMapRuntimeHost,
  bbox: [number, number, number, number] | null
): void {
  if (!isValidBbox(bbox)) return
  const fitBbox = bufferBbox(bbox)
  runGeoinsightOrQueue(host, () => {
    getGeoinsightRef()?.zoomToBBOX?.(getGeoinsightMapId(), {
      epsg: GEOINSIGHT_EPSG_WGS84,
      bbox: [...fitBbox],
    })
    window.setTimeout(() => {
      syncGeoinsightZoomFromMap()
      clampGeoinsightZoomToMax(VIEW_MAX_ZOOM)
    }, ZOOM_CLAMP_DELAY_MS)
  })
}

const WEB_MERCATOR_RESOLUTION_BASE = 156543.03392804097
// Vendor snaps zoomToPoint to discrete levels (~1.0-1.3 apart: …16.85, 17.85, 19.17).
// A +1 step from 16.85 targeted 17.00 which snapped back to 16.85 (runtime evidence),
// stalling the drill; +1.5 guarantees landing on the next discrete level.
const DRILL_MIN_ZOOM_STEP = 1.5

/** Zoom needed so the bbox fits the viewport (WGS84 degrees -> web mercator resolution). */
function fitZoomForBbox(bbox: [number, number, number, number]): number {
  const [minLon, minLat, maxLon, maxLat] = bbox
  const midLat = (minLat + maxLat) / 2
  const cosLat = Math.max(0.2, Math.cos((midLat * Math.PI) / 180))
  const widthM = Math.max(1, (maxLon - minLon) * 111_320 * cosLat)
  const heightM = Math.max(1, (maxLat - minLat) * 111_320)
  const { width, height } = readMapViewportPx()
  const resolution = Math.max(widthM / width, heightM / height)
  return Math.log2((WEB_MERCATOR_RESOLUTION_BASE * cosLat) / resolution)
}

/**
 * Drill zoom via zoomToPoint: the vendor zoomToBBOX silently ignores very small
 * bboxes (cluster member extents), while zoomToPoint always applies (see debug logs).
 */
export function zoomGeoinsightToBboxViaPoint(
  host: GeoinsightMapRuntimeHost,
  bbox: [number, number, number, number] | null
): void {
  if (!isValidBbox(bbox)) return
  const fitBbox = bufferBbox(bbox)
  const [lon, lat] = bboxCenter(fitBbox)
  runGeoinsightOrQueue(host, () => {
    const ref = getGeoinsightRef()
    if (!ref?.zoomToPoint) return
    const currentZoom =
      parseZoomFromCenterScale(ref.getCenterAndScale?.(getGeoinsightMapId())) ?? 0
    const targetZoom = Math.min(
      VIEW_MAX_ZOOM,
      Math.max(fitZoomForBbox(fitBbox), currentZoom + DRILL_MIN_ZOOM_STEP)
    )
    ref.zoomToPoint(
      getGeoinsightMapId(),
      [lon, lat],
      GEOINSIGHT_EPSG_WGS84,
      webMercatorScaleForZoom(targetZoom)
    )
    window.setTimeout(() => syncGeoinsightZoomFromMap(), 200)
  })
}

/**
 * Cluster click drill: jump past the next server aggregation threshold
 * (region→province→municipality→grid→raw). Admin cluster bboxes are large, so a
 * plain fitZoom / +1.5 step often stays in the same band and clusters look stuck.
 */
export function zoomGeoinsightForClusterDrill(
  host: GeoinsightMapRuntimeHost,
  bbox: [number, number, number, number] | null
): void {
  runGeoinsightOrQueue(host, () => {
    const ref = getGeoinsightRef()
    if (!ref?.zoomToPoint) return
    const status = ref.getCenterAndScale?.(getGeoinsightMapId()) as
      | { center?: number[]; epsg?: string }
      | undefined
    const currentZoom = parseZoomFromCenterScale(status) ?? 0
    const drillZoom = nextClusterDrillZoom(currentZoom)

    let lon: number
    let lat: number
    let epsg = GEOINSIGHT_EPSG_WGS84
    let targetZoom = drillZoom
    if (isValidBbox(bbox)) {
      const fitBbox = bufferBbox(bbox)
      ;[lon, lat] = bboxCenter(fitBbox)
      const fitZoom = fitZoomForBbox(fitBbox)
      // Prefer a tighter fit only when it zooms in further than the threshold jump
      // (small grid cells). Never use a large-admin fit that would zoom out.
      if (fitZoom > currentZoom) {
        targetZoom = Math.min(VIEW_MAX_ZOOM, Math.max(drillZoom, fitZoom))
      }
    } else {
      const center = status?.center
      if (!center || center.length < 2) return
      ;[lon, lat] = [center[0], center[1]]
      epsg = status?.epsg ?? GEOINSIGHT_EPSG_WGS84
    }

    ref.zoomToPoint(
      getGeoinsightMapId(),
      [lon, lat],
      epsg,
      webMercatorScaleForZoom(targetZoom)
    )
    window.setTimeout(() => syncGeoinsightZoomFromMap(), 200)
  })
}

/**
 * Fit the view to a bbox via zoomToPoint (both zoom-in and zoom-out).
 * The vendor zoomToBBOX silently ignores some requests (observed on drill
 * bboxes); zoomToPoint with a computed fit zoom always applies, so breadcrumb
 * navigation (e.g. sub-area -> municipality) reliably zooms back out.
 *
 * `zoomOffset` (negative = zoom out) is applied after the fit computation so
 * municipality framing can show more surrounding territory.
 */
export function fitGeoinsightToBboxViaPoint(
  host: GeoinsightMapRuntimeHost,
  bbox: [number, number, number, number] | null,
  options?: { zoomOffset?: number }
): void {
  if (!isValidBbox(bbox)) return
  const fitBbox = bufferBbox(bbox)
  const [lon, lat] = bboxCenter(fitBbox)
  const zoomOffset = options?.zoomOffset ?? 0
  runGeoinsightOrQueue(host, () => {
    const ref = getGeoinsightRef()
    if (!ref?.zoomToPoint) return
    const targetZoom = Math.min(
      VIEW_MAX_ZOOM,
      Math.max(0, fitZoomForBbox(fitBbox) + zoomOffset)
    )
    ref.zoomToPoint(
      getGeoinsightMapId(),
      [lon, lat],
      GEOINSIGHT_EPSG_WGS84,
      webMercatorScaleForZoom(targetZoom)
    )
    window.setTimeout(() => syncGeoinsightZoomFromMap(), 200)
  })
}

function clampGeoinsightZoomToMax(maxZoom: number): void {
  const ref = getGeoinsightRef()
  if (!ref?.getCenterAndScale || !ref?.zoomToPoint) return
  const status = ref.getCenterAndScale(getGeoinsightMapId()) as
    | { center?: number[]; epsg?: string }
    | undefined
  const currentZoom = parseZoomFromCenterScale(status)
  if (currentZoom == null || currentZoom <= maxZoom) return
  const center = status?.center
  if (!center || center.length < 2) return
  ref.zoomToPoint(
    getGeoinsightMapId(),
    [center[0], center[1]],
    status?.epsg ?? GEOINSIGHT_EPSG_WGS84,
    webMercatorScaleForZoom(maxZoom)
  )
  window.setTimeout(() => syncGeoinsightZoomFromMap(), 200)
}
