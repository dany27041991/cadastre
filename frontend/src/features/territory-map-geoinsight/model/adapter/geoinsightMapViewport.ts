/**
 * Geoinsight map viewport — zoom/pan/fit framing helpers.
 *
 * Implementation lives under `./viewport/`. This module re-exports the public
 * adapter API so existing imports stay stable.
 */
export {
  GREEN_DETAIL_FRAME_FRACTION_X,
  GREEN_DETAIL_FRAME_FRACTION_Y,
} from './viewport/constants'
export { syncGeoinsightZoomFromMap } from './viewport/syncZoom'
export {
  zoomGeoinsightToBbox,
  zoomGeoinsightToBboxViaPoint,
  zoomGeoinsightForClusterDrill,
  fitGeoinsightToBboxViaPoint,
} from './viewport/zoomBbox'
export type { ZoomToLonLatAtScreenFractionOptions } from './viewport/screenFraction'
export {
  panGeoinsightToLonLatKeepZoom,
  panGeoinsightToLonLatAtScreenFraction,
  zoomGeoinsightToLonLatAtScreenFraction,
} from './viewport/screenFraction'
