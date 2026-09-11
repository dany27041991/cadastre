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
  // Always refetch areas with the viewport: pan-reuse kept stale GA_ and missed
  // parks that entered the bbox (centroid-filter survivors from the previous
  // centre never updated). Zoom≥min is the only gate.
  const fetchAreas =
    areasFetcher != null && zoom >= GREEN_AREAS_VIEWPORT_MIN_ZOOM
  const belowMinZoom = zoom < GREEN_AREAS_VIEWPORT_MIN_ZOOM
  let collection: GeoJSONFeatureCollection
  let areasCollection: GeoJSONFeatureCollection
  const t0 = performance.now()
  useGeoinsightStore.getState().beginGreenViewportLoad()
  try {
    ;[collection, areasCollection] = await Promise.all([
      fetcher(bbox, zoom),
      fetchAreas ? areasFetcher(bbox, zoom) : Promise.resolve(EMPTY_FEATURE_COLLECTION),
    ])
  } catch (err) {
    useGeoinsightStore.getState().endGreenViewportLoad()
    return
  }
  const fetchMs = performance.now() - t0
  // Drop stale responses: a newer pan/zoom refresh is already in flight.
  const staleDrop =
    seq !== host.greenViewportRequestSeq || host.greenViewportFetcher !== fetcher
  if (staleDrop) {
    useGeoinsightStore.getState().endGreenViewportLoad()
    return
  }

  const displayItems = serverViewportCollectionToDisplayItems(collection)
  const payload = buildGreenClusterLayerPayload(displayItems, viewportClusterZoom(zoom), zoom)
  const appendedAreas = appendGreenAreaViewportFeatures(payload, areasCollection)
  const nAssets = collection.features?.length ?? 0
  const nAreas = areasCollection.features?.length ?? 0
  const areaNames = (areasCollection.features ?? [])
    .slice(0, 8)
    .map((f) => String((f.properties as { name?: string } | null)?.name ?? ''))
  const hasGaribaldi = (areasCollection.features ?? []).some((f) =>
    String((f.properties as { name?: string } | null)?.name ?? '').includes('Garibaldi')
  )
  const nGeoms = payload.geometries.length
  const mountT0 = performance.now()

  mountGreenPayload(host, payload, zoom, {
    rawMode: true,
    fullReplace: reason !== APPLY_REASON.panViewport,
    reason,
  })
  host.lastAppliedViewportBbox = bbox
  const afterMountedAreas = host.lastGreenGeometries.filter((g) =>
    g.geom_id.startsWith('GA_')
  ).length
  runAfterGeoinsightVendorOps(host, () => {
    useGeoinsightStore.getState().endGreenViewportLoad()
  })
}
