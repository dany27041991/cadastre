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
  consumeFilterFit,
  peekFilterFit,
} from '@/features/territory/model/hooks/filterFitGate'
import { cancelScheduledFilterFitTimers } from '@/features/territory/model/hooks/fitAfterFilter'
import {
  APPLY_REASON,
  EMPTY_FEATURE_COLLECTION,
  GREEN_AREAS_VIEWPORT_MIN_ZOOM,
  GREEN_ZOOM_JITTER_EPSILON,
} from './constants'
import {
  cancelDeferredCercaFit,
  hasDeferredCercaFit,
} from './cercaFitDeferred'
import { GEOM_PREFIX } from '../../constants'
import { appendGreenAreaViewportFeatures, mountGreenPayload } from './mountPayload'
import {
  beginViewportLoadBurst,
  endViewportLoadBurst,
  holdViewportBurstMs,
  markAreasReadyForTable,
} from '@/features/territory/model/hooks/viewportLoadGate'
import type { GeoinsightGreenClusterHost } from './types'

/** Drop GA_ polygons when zoom is below the areas render gate. */
function clearMountedGreenAreas(host: GeoinsightGreenClusterHost): number {
  const gaIds = host.lastGreenGeometries
    .map((g) => g.geom_id)
    .filter((id) => id.startsWith(GEOM_PREFIX.greenArea))
  if (gaIds.length === 0) return 0
  for (const id of gaIds) {
    host.registry.removeByGeomId(id)
  }
  host.removeGeomIds(gaIds)
  host.lastGreenGeometries = host.lastGreenGeometries.filter(
    (g) => !g.geom_id.startsWith(GEOM_PREFIX.greenArea),
  )
  return gaIds.length
}

/** Max zoom drift before soft-stale assets from an old request are ignored. */
const SOFT_STALE_ZOOM_MAX_DRIFT = 2

function isUserCameraReason(reason: string): boolean {
  return (
    reason === APPLY_REASON.rawZoomChange ||
    reason === APPLY_REASON.panViewport ||
    reason.includes(APPLY_REASON.rawZoomChange) ||
    reason.includes(APPLY_REASON.panViewport)
  )
}

/** Selective Cerca results (not a national 500 dump). */
const SOFT_STALE_AREAS_MAX = 80

/** NetworkError retries for Cerca viewport-load (debug 4fe799 MinIO thrash). */
let cercaEmptyRetries = 0
const CERCA_EMPTY_RETRY_DELAYS_MS = [8000, 14000] as const

export function readCurrentGreenClusterZoom(): number {
  return (
    useGeoinsightStore.getState().mapZoom ??
    parseZoomFromCenterScale(getGeoinsightRef()?.getCenterAndScale?.(getGeoinsightMapId())) ??
    GREEN_CLUSTER_ZOOM_OVERVIEW
  )
}

function isCurrentSeq(
  host: GeoinsightGreenClusterHost,
  seq: number,
  fetcher: GeoinsightGreenClusterHost['greenViewportFetcher'],
): boolean {
  return seq === host.greenViewportRequestSeq && host.greenViewportFetcher === fetcher
}

/**
 * Server viewport mode: fetch bbox+zoom-sized data (raw assets or lakehouse gold
 * clusters) and mount it through the standard diff-mount pipeline. The client
 * never holds the full dataset, so this scales to the national territory.
 *
 * Areas and assets are fetched in parallel but mounted independently: Cerca
 * area match (~9s) must not wait for asset clusters (~23s). Waiting caused
 * staleDrop of both and fit saw nGa=0 forever (debug 4fe799 villa).
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
  // Areas only from GREEN_AREAS_VIEWPORT_MIN_ZOOM — even with Cerca filters
  // (debug 4fe799: filter bypass showed polygons at z6 + held cluster loader).
  const fetchAreas =
    areasFetcher != null && zoom >= GREEN_AREAS_VIEWPORT_MIN_ZOOM
  // Zoom/pan: keep clusters visible (no spinner). Loader only for Cerca/breadcrumb.
  const showLoader = !isUserCameraReason(reason)
  // Abort prior in-flight viewport HTTP so DuckDB/MinIO is not piled (NetworkError storm).
  beginViewportLoadBurst(reason)
  if (showLoader) useGeoinsightStore.getState().beginGreenViewportLoad()
  if (!fetchAreas) {
    clearMountedGreenAreas(host)
  }
  let loadEnded = false
  const endLoadOnce = (_why: string) => {
    if (loadEnded) return
    loadEnded = true
    endViewportLoadBurst(`${reason}:${_why}`)
    if (showLoader) useGeoinsightStore.getState().endGreenViewportLoad()
  }
  let areasCollection: GeoJSONFeatureCollection = EMPTY_FEATURE_COLLECTION
  let areasMountedEarly = false
  let assetsMountedForSeq = false

  // endLoad waits for Promise settlement (vendor/stale/empty-skip/fetch-error).
  // Do not use a watchdog to endLoad early (debug 4fe799: abort storm).

  const mountAreasEarly = (areas: GeoJSONFeatureCollection): boolean => {
    if (!fetchAreas) return true
    const nAreas = areas.features?.length ?? 0
    if (nAreas === 0) return true
    const current = isCurrentSeq(host, seq, fetcher)
    const softStale =
      !current &&
      peekFilterFit() &&
      nAreas > 0 &&
      nAreas <= SOFT_STALE_AREAS_MAX
    if (!current && !softStale) {
      return false
    }
    const payload = buildGreenClusterLayerPayload(
      serverViewportCollectionToDisplayItems(EMPTY_FEATURE_COLLECTION),
      viewportClusterZoom(zoom),
      zoom,
    )
    appendGreenAreaViewportFeatures(payload, areas)
    const userCamera = isUserCameraReason(reason)
    // Zoom/pan areas-early must NOT wipe GC_/GS_ (debug 4fe799: cluster flash).
    // Cerca viewport-load may clear prior national clusters.
    mountGreenPayload(host, payload, zoom, {
      rawMode: true,
      fullReplace: !userCamera,
      preserveAssets: userCamera,
      reason: `${reason}:areas-early`,
    })
    host.lastAppliedViewportBbox = bbox
    // Cerca: never fit/zoom/pan the camera (user + debug 4fe799 gold-20 / timeout-z16).
    if ((!userCamera || softStale) && peekFilterFit()) {
      cancelScheduledFilterFitTimers('areas-early-no-fit')
      cancelDeferredCercaFit('areas-early-no-fit')
      consumeFilterFit('cerca-no-camera')
    }
    areasMountedEarly = true
    markAreasReadyForTable(`${reason}:areas-early`)
    return true
  }

  let transportFail = false
  const assetsPromise = fetcher(bbox, zoom).catch(() => {
    transportFail = true
    return EMPTY_FEATURE_COLLECTION
  })

  const areasPromise = (
    fetchAreas
      ? areasFetcher(bbox, zoom)
      : Promise.resolve(EMPTY_FEATURE_COLLECTION)
  ).catch(() => {
    transportFail = true
    return EMPTY_FEATURE_COLLECTION
  })

  const mountCombined = (
    assets: GeoJSONFeatureCollection,
    areas: GeoJSONFeatureCollection,
    mountReason: string,
    _opts: { softStale: boolean },
  ): boolean => {
    const nAssets = assets.features?.length ?? 0
    const nAreas = areas.features?.length ?? 0
    // Empty NetworkError responses must not wipe GA_ (debug 4fe799 clear-areas-replace).
    if (nAssets === 0 && nAreas === 0) return false
    const payload = buildGreenClusterLayerPayload(
      serverViewportCollectionToDisplayItems(assets),
      viewportClusterZoom(zoom),
      zoom,
    )
    const appendedAreas = appendGreenAreaViewportFeatures(payload, areas)
    // If areas fetch failed but GA_ already on map, keep them by not mounting
    // an areas-empty fullReplace — only when areas are in-zoom-gate.
    // Below min zoom never re-inject GA_ (debug 4fe799 areas-zoom-gate).
    if (nAreas === 0 && appendedAreas === 0) {
      const hasMountedGa = host.lastGreenGeometries.some((g) =>
        g.geom_id.startsWith('GA_'),
      )
      if (fetchAreas && hasMountedGa && nAssets > 0) {
        // Assets-only: rebuild payload without clearing areas — inject prev GA_
        // via fullReplace false + payload that still lists current area geoms.
        for (const g of host.lastGreenGeometries) {
          if (!g.geom_id.startsWith('GA_')) continue
          payload.geometries.unshift(g)
        }
      } else if (fetchAreas && hasMountedGa && nAssets === 0) {
        return false
      }
    }
    mountGreenPayload(host, payload, zoom, {
      rawMode: true,
      fullReplace: mountReason !== APPLY_REASON.panViewport,
      reason: mountReason,
    })
    host.lastAppliedViewportBbox = bbox
    return true
  }

  // Mount areas without waiting for slow asset match (Cerca).
  void areasPromise.then((areas) => {
    areasCollection = areas
    mountAreasEarly(areas)
  })

  // Mount assets when ready — even if seq advanced after fit zoom-storm
  // (debug 4fe799: ga_ids sum=808 then viewport_stale_drop).
  void assetsPromise.then((assets) => {
    const nAssets = assets.features?.length ?? 0
    if (nAssets === 0) {
      // Asset filter empty / still waiting areas: do not hold spinner forever
      // when areas are not fetched (below min zoom).
      if (!fetchAreas) endLoadOnce('assets-empty-no-areas')
      return
    }
    const current = isCurrentSeq(host, seq, fetcher)
    const zoomNow = readCurrentGreenClusterZoom()
    const zoomDrift = Math.abs(zoomNow - zoom)
    const softStale =
      !current &&
      (areasMountedEarly ||
        host.lastGreenGeometries.some((g) => g.geom_id.startsWith('GA_')))
    // After Cerca fit, ignore national-z soft-stale clusters (wrong LOD).
    // Before fit, still accept them so the jump can include GC_.
    const awaitingCercaFit = peekFilterFit() || hasDeferredCercaFit()
    if (
      !current &&
      softStale &&
      !awaitingCercaFit &&
      zoomDrift > SOFT_STALE_ZOOM_MAX_DRIFT + GREEN_ZOOM_JITTER_EPSILON
    ) {
      return
    }
    if (!current && !softStale) return
    const areas =
      fetchAreas && (areasCollection.features?.length ?? 0) > 0
        ? areasCollection
        : EMPTY_FEATURE_COLLECTION
    if (mountCombined(assets, areas, `${reason}:assets-ready`, { softStale })) {
      assetsMountedForSeq = true
      // Release cluster loader as soon as assets are on map — do not wait for
      // companion areas HTTP (debug 4fe799: asset filters + areas held spinner).
      endLoadOnce('assets-ready-early')
      if (peekFilterFit() || hasDeferredCercaFit()) {
        cancelDeferredCercaFit('assets-ready-no-fit')
        consumeFilterFit('cerca-no-camera-assets')
      }
    }
  })

  let collection: GeoJSONFeatureCollection
  try {
    ;[collection, areasCollection] = await Promise.all([assetsPromise, areasPromise])
  } catch {
    endLoadOnce('fetch-error')
    return
  }
  const nAssets = collection.features?.length ?? 0
  const nAreas = areasCollection.features?.length ?? 0

  if (!isCurrentSeq(host, seq, fetcher)) {
    endLoadOnce('stale')
    // Soft-stale assets already handled in assetsPromise.then.
    return
  }

  // Empty result: retry ONLY on transport failure (NetworkError). Legitimate
  // filter-empty (zril-127+villa → 0 hits) must not retry / hold burst ~100s
  // (debug 4fe799 cerca 3–4).
  if (nAssets === 0 && nAreas === 0) {
    if (
      reason === 'viewport-load' &&
      transportFail &&
      cercaEmptyRetries < CERCA_EMPTY_RETRY_DELAYS_MS.length
    ) {
      const delay = CERCA_EMPTY_RETRY_DELAYS_MS[cercaEmptyRetries] ?? 8000
      cercaEmptyRetries += 1
      holdViewportBurstMs(delay + 500, 'empty-retry')
      endLoadOnce('empty-retry-sched')
      window.setTimeout(() => {
        if (host.greenViewportFetcher == null) return
        void refreshGreenViewport(host, readCurrentGreenClusterZoom(), 'viewport-load')
      }, delay)
      return
    }
    cercaEmptyRetries = 0
    if (reason === 'viewport-load') {
      // Filter matched nothing: clear prior Cerca geometries (do not keep stale GA_).
      const emptyPayload = buildGreenClusterLayerPayload(
        serverViewportCollectionToDisplayItems(EMPTY_FEATURE_COLLECTION),
        viewportClusterZoom(zoom),
        zoom,
      )
      mountGreenPayload(host, emptyPayload, zoom, {
        rawMode: true,
        fullReplace: true,
        reason: `${reason}:filter-empty`,
      })
      host.lastAppliedViewportBbox = bbox
    }
    markAreasReadyForTable(`${reason}:empty-ok`)
    endLoadOnce(transportFail ? 'empty-skip' : 'empty-ok')
    return
  }
  cercaEmptyRetries = 0

  // assets-ready already mounted this seq — skip duplicate full remount
  // (debug 4fe799: 483 geoms mounted twice per zoom).
  let mounted = assetsMountedForSeq
  if (!assetsMountedForSeq) {
    mounted = mountCombined(collection, areasCollection, reason, {
      softStale: false,
    })
  } else {
  }
  if (
    mounted &&
    nAreas > 0 &&
    !areasMountedEarly &&
    !isUserCameraReason(reason) &&
    peekFilterFit()
  ) {
    consumeFilterFit('combined-mount-no-fit')
  }

  runAfterGeoinsightVendorOps(host, () => {
    endLoadOnce('vendor')
  })
}
