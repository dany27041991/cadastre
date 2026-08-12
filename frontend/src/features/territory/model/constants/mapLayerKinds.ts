/**
 * Map click layer kinds (geometry registry / feature select).
 * Keep in sync with territory-map-geoinsight registry producers.
 */
export const LAYER_KIND_TERRITORY = 'territory'
export const LAYER_KIND_GREEN_AREA = 'green_area'
export const LAYER_KIND_GREEN_ASSET = 'green_asset'
export const LAYER_KIND_CLUSTER = 'cluster'

export type MapLayerKind =
  | typeof LAYER_KIND_TERRITORY
  | typeof LAYER_KIND_GREEN_AREA
  | typeof LAYER_KIND_GREEN_ASSET
  | typeof LAYER_KIND_CLUSTER

export type GreenMapLayerKind =
  | typeof LAYER_KIND_GREEN_AREA
  | typeof LAYER_KIND_GREEN_ASSET

/** Detail modal entity kinds (API / FloatingPanel). */
export const GREEN_DETAIL_KIND_AREA = 'area'
export const GREEN_DETAIL_KIND_ASSET = 'asset'

export type GreenDetailKindConst =
  | typeof GREEN_DETAIL_KIND_AREA
  | typeof GREEN_DETAIL_KIND_ASSET

/** Detail modal async status. */
export const GREEN_DETAIL_STATUS_IDLE = 'idle'
export const GREEN_DETAIL_STATUS_LOADING = 'loading'
export const GREEN_DETAIL_STATUS_READY = 'ready'
export const GREEN_DETAIL_STATUS_ERROR = 'error'

export type GreenDetailStatusConst =
  | typeof GREEN_DETAIL_STATUS_IDLE
  | typeof GREEN_DETAIL_STATUS_LOADING
  | typeof GREEN_DETAIL_STATUS_READY
  | typeof GREEN_DETAIL_STATUS_ERROR
