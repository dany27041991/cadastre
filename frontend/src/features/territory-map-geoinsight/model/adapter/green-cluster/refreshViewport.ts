import { useGeoinsightStore } from '@/app/store/useGeoinsightStore'
import { GREEN_CLUSTER_ZOOM_OVERVIEW } from '@/features/territory/lib/greenAssetClusterCore'
import type { GeoJSONFeatureCollection } from '@/shared/types'
import { viewportBboxFromMapStatus } from '../../../lib/mapViewportBbox'
import {
  buildGreenClusterLayerPayload,
  serverViewportCollectionToDisplayItems,
  viewportClusterZoom,
} from '../../greenClusterPipeline'
import { parseZoomFromCenterScale } from '../../parseMapZoom'
import { GEOM_PREFIX } from '../../constants'
import {
  getGeoinsightMapId,
  getGeoinsightRef,
  runAfterGeoinsightVendorOps,
} from '../geoinsightMapRuntime'
import {
  APPLY_REASON,
  EMPTY_FEATURE_COLLECTION,
  GREEN_AREAS_VIEWPORT_MIN_ZOOM,
} from './constants'
import { appendGreenAreaViewportFeatures, mountGreenPayload } from './mountPayload'
import type { GeoinsightGreenClusterHost } from './types'

export function readCurrentGreenClusterZoom(): number {
  return (
    useGeoinsightStore.getState().mapZoom ??
    parseZoomFromCenterScale(getGeoinsightRef()?.getCenterAndScale?.(getGeoinsightMapId())) ??
    GREEN_CLUSTER_ZOOM_OVERVIEW
  )
}

/**
 * Server viewport mode: fetch bbox+zoom-sized data (raw assets or lakehouse gold
 * clusters) and mount it through the standard diff-mount pipeline. The client
 * never holds the full dataset, so this scales to the national territory.
 */
export async function refreshGreenViewport(
  host: GeoinsightGreenClusterHost,
  zoom: number,
  reason: string
): Promise<void> {
  const fetcher = host.greenViewportFetcher
  if (fetcher == null) return
  const mapStatus = getGeoinsightRef()?.getCenterAndScale?.(getGeoinsightMapId())
  const bbox = viewportBboxFromMapStatus(mapStatus)
  if (bbox == null) return

  const seq = ++host.greenViewportRequestSeq
  const areasFetcher = host.greenViewportAreasFetcher
  // Keep already-mounted GA_ polygons across zoom/pan. Refetching top-500 areas
  // every step caused multi-hundred-ms waits + toAdd/toRemove thrash.
  const hasMountedAreas = host.lastGreenGeometries.some((g) =>
    g.geom_id.startsWith(GEOM_PREFIX.greenArea)
  )
  const skipAreasReuse =
    hasMountedAreas &&
    (reason === APPLY_REASON.rawZoomChange || reason === APPLY_REASON.panViewport)
  const fetchAreas =
    areasFetcher != null && zoom >= GREEN_AREAS_VIEWPORT_MIN_ZOOM && !skipAreasReuse
  let collection: GeoJSONFeatureCollection
  let areasCollection: GeoJSONFeatureCollection
  useGeoinsightStore.getState().beginGreenViewportLoad()
  try {
    ;[collection, areasCollection] = await Promise.all([
      fetcher(bbox, zoom),
      fetchAreas ? areasFetcher(bbox, zoom) : Promise.resolve(EMPTY_FEATURE_COLLECTION),
    ])
  } catch {
    useGeoinsightStore.getState().endGreenViewportLoad()
    return
  }
  // Drop stale responses: a newer pan/zoom refresh is already in flight.
  if (seq !== host.greenViewportRequestSeq || host.greenViewportFetcher !== fetcher) {
    useGeoinsightStore.getState().endGreenViewportLoad()
    return
  }

  const displayItems = serverViewportCollectionToDisplayItems(collection)
  const payload = buildGreenClusterLayerPayload(displayItems, viewportClusterZoom(zoom), zoom)
  appendGreenAreaViewportFeatures(payload, areasCollection)

  mountGreenPayload(host, payload, zoom, {
    rawMode: true,
    fullReplace: reason !== APPLY_REASON.panViewport,
    reason,
  })
  host.lastAppliedViewportBbox = bbox
  // The heavy phase is not the fetch but the vendor processing of the queued
  // mount ops (and the GC it triggers): keep the loading indicator up until
  // the vendor op queue has drained.
  runAfterGeoinsightVendorOps(host, () => {
    useGeoinsightStore.getState().endGreenViewportLoad()
  })
}
