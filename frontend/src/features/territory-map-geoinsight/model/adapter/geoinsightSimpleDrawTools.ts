/**
 * Geoinsight toolbar simpledraw — restrict geometry types during "draw on map".
 * Official filter: tools.configs.simpledraw.geometries (map-widget SimpleDrawWidget).
 *
 * Implementation is split under `./simple-draw/` (host access, widget sync, keep-clip
 * guard, tool config, OL layer style, geometry ops). This module re-exports the
 * public adapter API so existing imports stay stable.
 */
export { getMapWidgetProxy } from './simple-draw/mapWidgetHost'
export { setKeepGeoinsightSimpleDrawClipFeatures } from './simple-draw/clipKeepGuard'
export {
  restrictGeoinsightSimpleDrawToClosedShapes,
  restoreGeoinsightSimpleDrawTools,
} from './simple-draw/toolConfig'
export {
  clearGeoinsightSimpleDrawGeometries,
  deactivateGeoinsightSimpleDrawTool,
  keepOnlyLastGeoinsightSimpleDrawGeometry,
} from './simple-draw/geometries'
export {
  raiseGeoinsightSimpleDrawLayer,
  styleGeoinsightSimpleDrawOutline,
} from './simple-draw/layerOps'
