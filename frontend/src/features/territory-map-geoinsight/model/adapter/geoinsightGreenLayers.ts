import type { GeoJSONFeatureCollection } from '@/shared/types'
import type { TerritoryMapFeature } from '@/features/territory/types/mapFeature'
import {
  largestComponentBbox,
  unionBboxes,
} from '@/features/territory/lib/geoJsonToGeoinsight'
import { GEOM_PREFIX, GREEN_AREA_GEOMETRY_COLOR } from '../constants'
import type { GeoinsightGreenClusterHost, GreenViewportFetcher } from './geoinsightGreenCluster'
import {
  clearGreenLayerPrefixes,
  readCurrentGreenClusterZoom,
  refreshGreenViewport,
  resetGreenAssetClusterState,
} from './geoinsightGreenCluster'
import { cancelRawClusterApply } from './green-cluster/scheduleApply'
import { cancelPanStalePrune } from './green-cluster/panStalePrune'
import type { GeoinsightAdapterHost } from './geoinsightAdapterHost'
import { loadLayerFromGeoJson } from './geoinsightLayerLoader'
import {
  AREA_FIT_MIN_PAD_DEGREES,
  MUNICIPALITY_FRAME_ZOOM_OFFSET,
} from '../mapZoomUtils'
import { fitGeoinsightToBboxViaPoint } from './geoinsightMapViewport'
import { reassertGreenDetailHighlight } from './geoinsightDetailHighlight'
import type { GreenDetailHighlightHost } from './geoinsightDetailHighlight'

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
  reassertGreenDetailHighlight(host as unknown as GreenDetailHighlightHost)
}

export type FitGreenExtentOptions = {
  /** Restrict framing to these layer kinds (e.g. only GA_ after area Cerca). */
  layerKinds?: ReadonlyArray<'green_area' | 'green_asset' | 'cluster'>
}

export function fitGreenExtent(
  host: GeoinsightAdapterHost,
  includeTerritoryBbox = true,
  options?: FitGreenExtentOptions
): void {
  // Include the territory outline bbox (municipality / parent area boundary):
  // fitting only the green-areas union framed a tighter view than the
  // province -> municipality navigation, which shows the whole admin unit.
  // Drill-in (click on an area) opts out: it must frame the clicked area only.
  const kinds = options?.layerKinds
  const areaOnly =
    kinds != null && kinds.length === 1 && kinds[0] === 'green_area'
  const areaEntries = [...host.registry.getIdsByPrefix(GEOM_PREFIX.greenArea)]
    .map((id) => host.registry.getByGeomId(id))
    .filter((e): e is NonNullable<typeof e> => e != null)
  // Area-only Cerca: frame the largest polygon part, not the MultiPolygon
  // envelope (disconnected slivers center the camera on empty gap).
  let bboxes: Array<[number, number, number, number] | null> = areaOnly
    ? areaEntries.map(
        (e) => largestComponentBbox(e.geometry) ?? e.bbox
      )
    : kinds
      ? [...host.registry.getGreenBboxesByKinds(kinds)]
      : [...host.registry.getGreenBboxes()]
  // Fallback: preferred kinds empty (race before mount) → all green.
  if ((kinds || areaOnly) && bboxes.every((b) => b == null)) {
    bboxes = [...host.registry.getGreenBboxes()]
  }
  if (includeTerritoryBbox && host.lastTerritoryFitBbox) {
    bboxes.push(host.lastTerritoryFitBbox)
  }
  const fitBbox = unionBboxes(bboxes)
  // Race before filtered GA_ mount (debug 4fe799 villa: nBboxes=0 at 1.4s).
  if (!fitBbox) return
  // Via zoomToPoint: zoomToBBOX silently ignored requests, leaving the view at
  // the deep sub-area zoom when navigating back to the municipality crumb.
  // When framing the municipality (includeTerritoryBbox), apply the same
  // zoom-out offset used by province → municipality navigation.
  fitGeoinsightToBboxViaPoint(host, fitBbox, {
    // Area-only: tight pad + slight zoom-in so thin MultiPolygon parts
    // (e.g. Area boost 3 ~20 m tall) are readable, not a 2%-viewport hairline.
    zoomOffset: includeTerritoryBbox
      ? MUNICIPALITY_FRAME_ZOOM_OFFSET
      : areaOnly
        ? 1.5
        : 0,
    ...(areaOnly ? { minPadDegrees: AREA_FIT_MIN_PAD_DEGREES } : {}),
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
  // Static area mounts also cover GH_ — keep detail selector on top.
  reassertGreenDetailHighlight(host as unknown as GreenDetailHighlightHost)
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
  // Do NOT clearGreenLayerPrefixes here: Cerca wiped the map for 10–70s, then
  // NetworkError left it blank (debug 4fe799). Keep prior GA_/GC_ until the new
  // viewport mounts (fullReplace / preserveAssets handles the swap).
  cancelRawClusterApply(host)
  cancelPanStalePrune(host)
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
  const toRemove = greenGeomIdsOnMap(host)
  host.removeGeomIds(toRemove)
  // Hide orphan cluster-count label text (debug 4fe799 toggle off).
  host.addGeometries([], { showLabels: false })
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
  host.addGeometries([], { showLabels: false })
}
