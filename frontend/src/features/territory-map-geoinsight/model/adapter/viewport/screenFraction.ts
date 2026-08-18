import { getResolutionForZoomWebMercator } from '@/features/territory/lib/greenAssetClusterCore'
import { parseZoomFromCenterScale } from '../../parseMapZoom'
import { isValidBbox, bufferBbox, VIEW_MAX_ZOOM, webMercatorScaleForZoom } from '../../mapZoomUtils'
import { GEOINSIGHT_EPSG_WGS84 } from '../../constants'
import { readMapViewportPx } from '../../../lib/mapViewportBbox'
import {
  getGeoinsightMapId,
  getGeoinsightRef,
  runGeoinsightOrQueue,
  type GeoinsightMapRuntimeHost,
} from '../geoinsightMapRuntime'
import {
  DRILL_MIN_ZOOM_STEP,
  GREEN_DETAIL_FRAME_FRACTION_X,
  GREEN_DETAIL_FRAME_FRACTION_Y,
  METERS_PER_DEGREE,
} from './constants'
import { fitZoomForBbox } from './fitMath'
import { syncGeoinsightZoomFromMap } from './syncZoom'

/**
 * Pan so [lon, lat] sits at the map viewport center without changing zoom.
 * Used to frame green detail: feature at a fixed screen point, panel above it.
 */
export function panGeoinsightToLonLatKeepZoom(
  host: GeoinsightMapRuntimeHost,
  lon: number,
  lat: number
): void {
  panGeoinsightToLonLatAtScreenFraction(host, lon, lat, 0.5, 0.5)
}

/**
 * Pan (keep zoom) so [lon, lat] lands at a viewport fraction.
 * fractionX/Y are 0–1 relative to the map viewport (0.5, 0.2 = center / 20% from top).
 */
export function panGeoinsightToLonLatAtScreenFraction(
  host: GeoinsightMapRuntimeHost,
  lon: number,
  lat: number,
  fractionX = GREEN_DETAIL_FRAME_FRACTION_X,
  fractionY = GREEN_DETAIL_FRAME_FRACTION_Y
): void {
  zoomGeoinsightToLonLatAtScreenFraction(host, lon, lat, {
    fractionX,
    fractionY,
    keepZoom: true,
  })
}

export type ZoomToLonLatAtScreenFractionOptions = {
  /** Fit zoom from this bbox (buffered). Ignored when keepZoom is true. */
  bbox?: [number, number, number, number] | null
  fractionX?: number
  fractionY?: number
  /** When true, only pan — same zoom as current view. */
  keepZoom?: boolean
  /** Green assets: always zoom to VIEW_MAX_ZOOM (point/tiny bbox fit is too shallow). */
  forceMaxZoom?: boolean
}

/**
 * Place [lon, lat] at a viewport fraction, optionally zooming to fit `bbox`.
 * Green detail opens here: object framed under the floating panel (0.5, 0.2).
 */
export function zoomGeoinsightToLonLatAtScreenFraction(
  host: GeoinsightMapRuntimeHost,
  lon: number,
  lat: number,
  options?: ZoomToLonLatAtScreenFractionOptions
): void {
  if (!Number.isFinite(lon) || !Number.isFinite(lat)) return
  const fractionX = options?.fractionX ?? GREEN_DETAIL_FRAME_FRACTION_X
  const fractionY = options?.fractionY ?? GREEN_DETAIL_FRAME_FRACTION_Y
  runGeoinsightOrQueue(host, () => {
    const ref = getGeoinsightRef()
    if (!ref?.zoomToPoint || !ref.getCenterAndScale) {
      return
    }
    const status = ref.getCenterAndScale(getGeoinsightMapId())
    const currentZoom = parseZoomFromCenterScale(status) ?? 0
    let targetZoom = currentZoom
    if (!options?.keepZoom) {
      if (options?.forceMaxZoom) {
        targetZoom = VIEW_MAX_ZOOM
      } else if (isValidBbox(options?.bbox)) {
        targetZoom = Math.min(
          VIEW_MAX_ZOOM,
          Math.max(0, fitZoomForBbox(bufferBbox(options.bbox)))
        )
      } else {
        // Point / unknown extent: nudge in so the object is readable.
        targetZoom = Math.min(VIEW_MAX_ZOOM, currentZoom + DRILL_MIN_ZOOM_STEP)
      }
    }
    const epsg = GEOINSIGHT_EPSG_WGS84
    const { width, height } = readMapViewportPx()
    const resolution = getResolutionForZoomWebMercator(targetZoom, lat)
    const cosLat = Math.max(0.2, Math.cos((lat * Math.PI) / 180))
    const centerLon =
      lon - ((fractionX - 0.5) * width * resolution) / (METERS_PER_DEGREE * cosLat)
    const centerLat =
      lat + ((fractionY - 0.5) * height * resolution) / METERS_PER_DEGREE
    ref.zoomToPoint(
      getGeoinsightMapId(),
      [centerLon, centerLat],
      epsg,
      webMercatorScaleForZoom(targetZoom)
    )
    window.setTimeout(() => syncGeoinsightZoomFromMap(), 200)
  })
}
