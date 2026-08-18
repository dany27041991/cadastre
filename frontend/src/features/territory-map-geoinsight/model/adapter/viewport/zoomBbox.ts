import { parseZoomFromCenterScale } from '../../parseMapZoom'
import {
  bboxCenter,
  bufferBbox,
  isValidBbox,
  nextClusterDrillZoom,
  VIEW_MAX_ZOOM,
  webMercatorScaleForZoom,
} from '../../mapZoomUtils'
import { GEOINSIGHT_EPSG_WGS84 } from '../../constants'
import {
  getGeoinsightMapId,
  getGeoinsightRef,
  runGeoinsightOrQueue,
  type GeoinsightMapRuntimeHost,
} from '../geoinsightMapRuntime'
import { DRILL_MIN_ZOOM_STEP, ZOOM_CLAMP_DELAY_MS } from './constants'
import { fitZoomForBbox } from './fitMath'
import { clampGeoinsightZoomToMax, syncGeoinsightZoomFromMap } from './syncZoom'

export function zoomGeoinsightToBbox(
  host: GeoinsightMapRuntimeHost,
  bbox: [number, number, number, number] | null
): void {
  if (!isValidBbox(bbox)) {
    return
  }
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
  if (!isValidBbox(bbox)) {
    return
  }
  const fitBbox = bufferBbox(bbox)
  const [lon, lat] = bboxCenter(fitBbox)
  const zoomOffset = options?.zoomOffset ?? 0
  runGeoinsightOrQueue(host, () => {
    const ref = getGeoinsightRef()
    if (!ref?.zoomToPoint) {
      return
    }
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
