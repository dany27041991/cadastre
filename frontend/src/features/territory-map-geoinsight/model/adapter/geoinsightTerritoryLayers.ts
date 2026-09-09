import type { GeoJSONFeatureCollection } from '@/shared/types'
import type { TerritoryMapFeature } from '@/features/territory/types/mapFeature'
import {
  geoJsonToGeoinsightGeometries,
  unionBboxes,
} from '@/features/territory/lib/geoJsonToGeoinsight'
import { GEOM_PREFIX, TERRITORY_GEOMETRY_FILL_COLOR } from '../constants'
import type { GeoinsightAdapterHost } from './geoinsightAdapterHost'
import { loadLayerFromGeoJson } from './geoinsightLayerLoader'
import {
  readCurrentGreenClusterZoom,
  refreshGreenViewport,
} from './green-cluster/refreshViewport'
import type { GeoinsightGreenClusterHost } from './green-cluster/types'
import { MUNICIPALITY_FRAME_ZOOM_OFFSET } from '../mapZoomUtils'
import { fitGeoinsightToBboxViaPoint, zoomGeoinsightToBbox } from './geoinsightMapViewport'

/** Remount green after territory is on the map (avoids race that wiped T_*). */
function remountGreenAfterTerritory(host: GeoinsightAdapterHost): void {
  const greenHost = host as GeoinsightGreenClusterHost
  if (!greenHost.greenAssetClusteringActive || greenHost.greenViewportFetcher == null) {
    return
  }
  void refreshGreenViewport(
    greenHost,
    readCurrentGreenClusterZoom(),
    'viewport-load'
  )
}

export function loadTerritoryGeoJson(
  host: GeoinsightAdapterHost,
  geojson: GeoJSONFeatureCollection
): void {
  loadLayerFromGeoJson(
    host,
    geojson,
    GEOM_PREFIX.territory,
    'territory',
    TERRITORY_GEOMETRY_FILL_COLOR,
    [GEOM_PREFIX.territory]
  )
  remountGreenAfterTerritory(host)
}

export function loadTerritoryGeoJsonAndShowOnlyFeatureById(
  host: GeoinsightAdapterHost,
  geojson: GeoJSONFeatureCollection,
  featureId: number
): void {
  const match = geojson.features?.find(
    (f) => f.id === featureId || (f.properties?.id as number) === featureId
  )
  if (!match) {
    loadTerritoryGeoJson(host, geojson)
    host.lastTerritoryFitBbox = unionBboxes(host.registry.getTerritoryBboxes())
    fitTerritoryExtent(host)
    return
  }
  const single: GeoJSONFeatureCollection = {
    type: 'FeatureCollection',
    features: [match],
  }
  loadTerritoryGeoJson(host, single)
  const { metas } = geoJsonToGeoinsightGeometries(single, GEOM_PREFIX.territory)
  const bbox = metas[0]?.bbox ?? null
  host.lastTerritoryFitBbox = bbox
  // Municipality framing (province → comune): same zoom-out as sub → comune.
  fitGeoinsightToBboxViaPoint(host, bbox, { zoomOffset: MUNICIPALITY_FRAME_ZOOM_OFFSET })
}

export function fitTerritoryExtent(host: GeoinsightAdapterHost): void {
  zoomGeoinsightToBbox(host, unionBboxes(host.registry.getTerritoryBboxes()))
}

export function showOnlyTerritoryFeature(
  host: GeoinsightAdapterHost,
  feature: TerritoryMapFeature
): void {
  const removed = host.registry.removeByPrefix(GEOM_PREFIX.territory)
  host.removeGeomIds(removed)
  const single: GeoJSONFeatureCollection = {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        id: feature.id,
        properties: feature.properties,
        geometry: feature.geometry,
      },
    ],
  }
  loadTerritoryGeoJson(host, single)
  const bbox = geoJsonToGeoinsightGeometries(single, GEOM_PREFIX.territory).metas[0]?.bbox ?? null
  host.lastTerritoryFitBbox = bbox
  // Municipality framing (province → comune): same zoom-out as sub → comune.
  fitGeoinsightToBboxViaPoint(host, bbox, { zoomOffset: MUNICIPALITY_FRAME_ZOOM_OFFSET })
}

export function clearTerritoryLayer(host: GeoinsightAdapterHost): void {
  const ids = host.registry.removeByPrefix(GEOM_PREFIX.territory)
  host.removeGeomIds(ids)
  host.lastTerritoryGeometries = []
  host.lastTerritoryFitBbox = null
}

export function clearAllVectorLayers(host: GeoinsightAdapterHost): void {
  const greenHost = host as GeoinsightGreenClusterHost
  const ids = host.registry.removeAll()
  host.removeGeomIds(ids)
  host.lastTerritoryGeometries = []
  host.lastTerritoryFitBbox = null
  // Reset green diff baseline only — do NOT refresh here. An async viewport
  // remount raced with loadGeoJson and left admin territory missing (T_*).
  // Green is remounted after territory in loadTerritoryGeoJson.
  host.lastGreenGeometries = []
  greenHost.lastAppliedGreenAssetZoom = null
}

export function setTerritoryFillVisible(host: GeoinsightAdapterHost, visible: boolean): void {
  if (!visible) {
    const ids = host.registry.removeByPrefix(GEOM_PREFIX.territory)
    host.removeGeomIds(ids)
    return
  }
  if (host.lastTerritoryGeometries.length > 0) {
    host.addGeometries(host.lastTerritoryGeometries)
  }
}
