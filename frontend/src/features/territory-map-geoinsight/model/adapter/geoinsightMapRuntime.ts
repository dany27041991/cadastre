/**
 * Geoinsight map runtime — vendor queue, geometry add/remove, draw-clip persist.
 *
 * Implementation lives under `./runtime/`. This module re-exports the public
 * adapter API so existing imports stay stable.
 */
export type { GeoinsightMapRuntimeHost } from './runtime/types'
export { getGeoinsightRef, getGeoinsightMapId } from './runtime/ref'
export { flushGeoinsightPending, runGeoinsightOrQueue } from './runtime/pendingQueue'
export {
  removeGeoinsightGeomIds,
  addGeoinsightGeometries,
  runAfterGeoinsightVendorOps,
} from './runtime/vendorOps'
export { activateGeoinsightDrawnGeometryInfo } from './runtime/drawnGeometryInfo'
export {
  activateGeoinsightDrawPolygon,
  deactivateGeoinsightDrawGeometry,
  deleteAllGeoinsightDrawnGeometries,
  zoomGeoinsightToWgs84Bbox,
} from './runtime/drawControls'
export {
  persistGeoinsightDrawClip,
  clearPersistedGeoinsightDrawClip,
} from './runtime/drawClipPersist'
