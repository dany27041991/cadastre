import type { GeoJSONFeatureCollection } from '@/shared/types'
import type { TerritoryMapFeature } from '@/features/territory/types/mapFeature'
import { unionBboxes } from '@/features/territory/lib/geoJsonToGeoinsight'
import { GEOM_PREFIX, GREEN_AREA_GEOMETRY_COLOR } from '../constants'
import type { GeoinsightGreenClusterHost, GreenViewportFetcher } from './geoinsightGreenCluster'
import {
  clearGreenLayerPrefixes,
  readCurrentGreenClusterZoom,
  refreshGreenViewport,
  resetGreenAssetClusterState,
} from './geoinsightGreenCluster'
import type { GeoinsightAdapterHost } from './geoinsightAdapterHost'
import { loadLayerFromGeoJson } from './geoinsightLayerLoader'
import { MUNICIPALITY_FRAME_ZOOM_OFFSET } from '../mapZoomUtils'
import { fitGeoinsightToBboxViaPoint } from './geoinsightMapViewport'

const GREEN_REVEAL_DELAY_MS = 480

export interface GeoinsightGreenLayerHost extends GeoinsightGreenClusterHost {
  greenRevealGen: number
}

function greenGeomIdsOnMap(host: GeoinsightAdapterHost): string[] {
  return [
    ...host.registry.getIdsByPrefix(GEOM_PREFIX.greenArea),
    ...host.registry.getIdsByPrefix(GEOM_PREFIX.greenAsset),
    ...host.registry.getGeomIdsByLayerKind('cluster'),
  ]
}

function syncGreenGeometriesToMap(host: GeoinsightGreenLayerHost): void {
  if (!host.greenLayerVisible || host.lastGreenGeometries.length === 0) return
  host.addGeometries(host.lastGreenGeometries, {
    showLabels: host.lastGreenShowClusterCountLabels,
  })
}

export function fitGreenExtent(
  host: GeoinsightAdapterHost,
  includeTerritoryBbox = true
): void {
  // Include the territory outline bbox (municipality / parent area boundary):
  // fitting only the green-areas union framed a tighter view than the
  // province -> municipality navigation, which shows the whole admin unit.
  // Drill-in (click on an area) opts out: it must frame the clicked area only.
  const bboxes = [...host.registry.getGreenBboxes()]
  if (includeTerritoryBbox && host.lastTerritoryFitBbox) {
    bboxes.push(host.lastTerritoryFitBbox)
  }
  // Via zoomToPoint: zoomToBBOX silently ignored requests, leaving the view at
  // the deep sub-area zoom when navigating back to the municipality crumb.
  // When framing the municipality (includeTerritoryBbox), apply the same
  // zoom-out offset used by province → municipality navigation.
  fitGeoinsightToBboxViaPoint(host, unionBboxes(bboxes), {
    zoomOffset: includeTerritoryBbox ? MUNICIPALITY_FRAME_ZOOM_OFFSET : 0,
  })
}

/**
 * Mounts green area polygons (no clustering): used for the green-areas level
 * and for restoring areas after turning the assets layer off. Asset rendering
 * always goes through the server viewport mode (loadGreenLayerViewport).
 */
export function loadGreenLayer(
  host: GeoinsightGreenLayerHost,
  geojson: GeoJSONFeatureCollection,
  options?: { skipFit?: boolean }
): void {
  clearGreenLayerPrefixes(host)
  // The map is now empty of green geometries: reset the diff-mount baseline so the
  // next mount adds everything instead of skipping ids it believes are still mounted.
  host.lastGreenGeometries = []
  resetGreenAssetClusterState(host)
  // Visible before load: loadLayerFromGeoJson already adds to the map, a second
  // syncGreenGeometriesToMap here duplicated every geometry (debug logs: ADD x3).
  host.greenLayerVisible = true
  const geometries = loadLayerFromGeoJson(
    host,
    geojson,
    GEOM_PREFIX.greenArea,
    'green_area',
    GREEN_AREA_GEOMETRY_COLOR,
    []
  )
  host.lastGreenGeometries = geometries
  if (!options?.skipFit) fitGreenExtent(host)
}

/**
 * Server viewport mode: the layer is fed per-bbox by the backend viewport
 * endpoint instead of one full-dataset download (national-scale rendering).
 * Zoom/pan settles trigger refetches through the standard debounce pipeline.
 */
export function loadGreenLayerViewport(
  host: GeoinsightGreenLayerHost,
  fetcher: GreenViewportFetcher,
  areasFetcher?: GreenViewportFetcher
): void {
  clearGreenLayerPrefixes(host)
  resetGreenAssetClusterState(host)
  host.lastGreenGeometries = []
  host.greenAssetClusteringActive = true
  host.greenViewportFetcher = fetcher
  host.greenViewportAreasFetcher = areasFetcher ?? null
  host.greenLayerVisible = true
  void refreshGreenViewport(host, readCurrentGreenClusterZoom(), 'viewport-load')
}

export function loadGreenLayerFromFeature(
  host: GeoinsightGreenLayerHost,
  feature: TerritoryMapFeature,
  options?: { skipFit?: boolean }
): void {
  loadGreenLayer(
    host,
    {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          id: feature.id,
          properties: feature.properties,
          geometry: feature.geometry,
        },
      ],
    },
    { skipFit: options?.skipFit }
  )
}

export function getGreenLayerFeatures(host: GeoinsightAdapterHost): TerritoryMapFeature[] {
  return [...host.registry.getIdsByPrefix(GEOM_PREFIX.greenArea), ...host.registry.getIdsByPrefix(GEOM_PREFIX.greenAsset)]
    .map((geomId) => host.registry.getByGeomId(geomId))
    .filter((entry): entry is NonNullable<typeof entry> => entry != null)
    .map((entry) => host.registry.toMapFeature(entry))
}

export function setGreenLayerVisible(host: GeoinsightGreenLayerHost, visible: boolean): void {
  // No-op when state is unchanged: re-syncing while visible re-added every geometry
  // to the vendor map (duplicate render load, see debug logs).
  if (host.greenLayerVisible === visible) return
  host.greenLayerVisible = visible
  if (visible) {
    syncGreenGeometriesToMap(host)
    return
  }
  host.removeGeomIds(greenGeomIdsOnMap(host))
}

export function setGreenLayerVisibleWhenMoveEnds(host: GeoinsightGreenLayerHost): void {
  setGreenLayerVisible(host, false)
}

export function ensureGreenLayerVisibleAfterFit(host: GeoinsightGreenLayerHost): void {
  const gen = ++host.greenRevealGen
  window.setTimeout(() => {
    if (gen !== host.greenRevealGen) return
    setGreenLayerVisible(host, true)
  }, GREEN_REVEAL_DELAY_MS)
}

export function clearGreenLayer(host: GeoinsightGreenLayerHost): void {
  host.greenRevealGen += 1
  // Remove from the vendor map BEFORE reset: reset clears lastGreenGeometries,
  // which is the only place that still lists cluster-count label geom_ids
  // (aliases like "12\u200BGC_…", not GC_/GS_/GA_ prefixes).
  clearGreenLayerPrefixes(host)
  resetGreenAssetClusterState(host)
  host.greenLayerVisible = false
}
