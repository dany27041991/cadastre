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
  beginProgrammaticFitSuppress,
  endProgrammaticFitSuppress,
  PROGRAMMATIC_FIT_SUPPRESS_MS,
} from './programmaticFitGuard'
import {
  beginViewportLoadBurst,
  endViewportLoadBurst,
  holdViewportBurstMs,
  markAreasReadyForTable,
} from '@/features/territory/model/hooks/viewportLoadGate'
import { finishPerfScan, markPerfScan } from '@/features/territory/lib/perfScan'
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

/** Avoid static cycle: geoinsightGreenLayers → cluster → refreshViewport. */
function fitAreasAfterMount(host: GeoinsightGreenClusterHost): void {
  // Kill remaining fitAfterFilter retries; gate already consumed by caller.
  cancelScheduledFilterFitTimers('areas-early-fit')
  beginProgrammaticFitSuppress()
  // Dynamic import avoids scheduleApply ↔ refreshViewport cycle.
  void import('./scheduleApply').then(({ cancelRawClusterApply }) => {
    cancelRawClusterApply(host)
  })
  void import('../geoinsightGreenLayers').then(({ fitGreenExtent }) => {
    fitGreenExtent(host, false, { layerKinds: ['green_area'] })
  })
  window.setTimeout(() => {
    endProgrammaticFitSuppress()
    // #region agent log
    fetch('http://127.0.0.1:7455/ingest/ee4d7135-3aef-4e11-b07a-3de89c3bf62c',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'4fe799'},body:JSON.stringify({sessionId:'4fe799',runId:'fit-suppress',hypothesisId:'H-fit-storm',location:'refreshViewport.ts:fitSettle',message:'fit_suppress_settle',data:{},timestamp:Date.now()})}).catch(()=>{})
    // #endregion
    if (!host.greenAssetClusteringActive || host.greenViewportFetcher == null) return
    void import('./scheduleApply').then(({ scheduleRawClusterApply }) => {
      scheduleRawClusterApply(host, APPLY_REASON.rawZoomChange)
    })
  }, PROGRAMMATIC_FIT_SUPPRESS_MS)
}

function runCercaFit(host: GeoinsightGreenClusterHost, why: string): void {
  if (!consumeFilterFit(`cerca-fit:${why}`)) {
    // #region agent log
    fetch('http://127.0.0.1:7455/ingest/ee4d7135-3aef-4e11-b07a-3de89c3bf62c',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'4fe799'},body:JSON.stringify({sessionId:'4fe799',runId:'fit-defer',hypothesisId:'H-fit-defer',location:'refreshViewport.ts:runCercaFit',message:'cerca_fit_skip',data:{why,alreadyFitted:true},timestamp:Date.now()})}).catch(()=>{})
    // #endregion
    return
  }
  // #region agent log
  fetch('http://127.0.0.1:7455/ingest/ee4d7135-3aef-4e11-b07a-3de89c3bf62c',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'4fe799'},body:JSON.stringify({sessionId:'4fe799',runId:'fit-defer',hypothesisId:'H-fit-defer',location:'refreshViewport.ts:runCercaFit',message:'cerca_fit_run',data:{why},timestamp:Date.now()})}).catch(()=>{})
  // #endregion
  fitAreasAfterMount(host)
}

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
  const t0 = performance.now()
  // Zoom/pan: keep clusters visible (no spinner). Loader only for Cerca/breadcrumb.
  const showLoader = !isUserCameraReason(reason)
  const loadCountBefore = useGeoinsightStore.getState().greenViewportLoadingCount
  // Abort prior in-flight viewport HTTP so DuckDB/MinIO is not piled (NetworkError storm).
  beginViewportLoadBurst(reason)
  if (showLoader) useGeoinsightStore.getState().beginGreenViewportLoad()
  if (!fetchAreas) {
    const cleared = clearMountedGreenAreas(host)
    // #region agent log
    fetch('http://127.0.0.1:7455/ingest/ee4d7135-3aef-4e11-b07a-3de89c3bf62c',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'4fe799'},body:JSON.stringify({sessionId:'4fe799',runId:'areas-zoom-gate',hypothesisId:'H-areas-min-zoom',location:'refreshViewport.ts:belowMin',message:'areas_below_min_cleared',data:{zoom,minZoom:GREEN_AREAS_VIEWPORT_MIN_ZOOM,clearedGa:cleared,areasFetcherPresent:areasFetcher!=null,reason},timestamp:Date.now()})}).catch(()=>{})
    // #endregion
  }
  // #region agent log
  fetch('http://127.0.0.1:7455/ingest/ee4d7135-3aef-4e11-b07a-3de89c3bf62c',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'4fe799'},body:JSON.stringify({sessionId:'4fe799',runId:'areas-zoom-gate',hypothesisId:'H-areas-min-zoom',location:'refreshViewport.ts:start',message:'viewport_refresh_start',data:{zoom,reason,seq,showLoader,loadCountBefore,fetchAreas,belowMin:zoom<GREEN_AREAS_VIEWPORT_MIN_ZOOM,minZoom:GREEN_AREAS_VIEWPORT_MIN_ZOOM,bbox,pendingFit:peekFilterFit(),deferredFit:hasDeferredCercaFit()},timestamp:Date.now()})}).catch(()=>{})
  // #endregion
  let loadEnded = false
  const endLoadOnce = (why: string) => {
    if (loadEnded) return
    loadEnded = true
    endViewportLoadBurst(`${reason}:${why}`)
    const loadCount = useGeoinsightStore.getState().greenViewportLoadingCount
    const elapsedMs = Math.round(performance.now() - t0)
    // #region agent log
    fetch('http://127.0.0.1:7455/ingest/ee4d7135-3aef-4e11-b07a-3de89c3bf62c',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'4fe799'},body:JSON.stringify({sessionId:'4fe799',runId:'loader-stuck',hypothesisId:'H-loader',location:'refreshViewport.ts:endLoad',message:'viewport_load_end',data:{why,zoom,reason,seq,showLoader,loadCount,elapsedMs,areasMountedEarly,assetsMountedForSeq},timestamp:Date.now()})}).catch(()=>{})
    // #endregion
    if (reason === 'viewport-load') {
      markPerfScan('viewport_loader_end', { why, zoom, seq, elapsedMs })
      finishPerfScan(`viewport:${why}`, {
        zoom,
        seq,
        elapsedMs,
        areasMountedEarly,
        assetsMountedForSeq,
      })
    }
    if (showLoader) useGeoinsightStore.getState().endGreenViewportLoad()
  }
  let areasCollection: GeoJSONFeatureCollection = EMPTY_FEATURE_COLLECTION
  let areasMountedEarly = false
  let assetsMountedForSeq = false

  // NEVER endLoad on watchdog (debug 4fe799 tee: why=watchdog @4s while areas still
  // in-flight → burst depth 0 → next refresh aborts → NetworkError storm / empty-skip).
  // Warn only; endLoad waits for Promise settlement (vendor/stale/empty-skip/fetch-error).
  const loadWatchdog = window.setTimeout(
    () => {
      // #region agent log
      fetch('http://127.0.0.1:7455/ingest/ee4d7135-3aef-4e11-b07a-3de89c3bf62c',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'4fe799'},body:JSON.stringify({sessionId:'4fe799',runId:'post-fix',hypothesisId:'H-watchdog',location:'refreshViewport.ts:watchdogWarn',message:'viewport_watchdog_warn',data:{zoom,reason,seq,elapsedMs:Math.round(performance.now()-t0),assetsMountedForSeq,areasMountedEarly,loadEnded},timestamp:Date.now()})}).catch(()=>{})
      // #endregion
    },
    reason === 'viewport-load' ? 60_000 : 8_000,
  )

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
      // #region agent log
      fetch('http://127.0.0.1:7455/ingest/ee4d7135-3aef-4e11-b07a-3de89c3bf62c',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'4fe799'},body:JSON.stringify({sessionId:'4fe799',runId:'areas-early',hypothesisId:'H-stale-drop',location:'refreshViewport.ts:areasEarlyReject',message:'areas_early_reject',data:{zoom,seq,nAreas,pendingFit:peekFilterFit(),reason},timestamp:Date.now()})}).catch(()=>{})
      // #endregion
      return false
    }
    const payload = buildGreenClusterLayerPayload(
      serverViewportCollectionToDisplayItems(EMPTY_FEATURE_COLLECTION),
      viewportClusterZoom(zoom),
      zoom,
    )
    const appendedAreas = appendGreenAreaViewportFeatures(payload, areas)
    // #region agent log
    fetch('http://127.0.0.1:7455/ingest/ee4d7135-3aef-4e11-b07a-3de89c3bf62c',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'4fe799'},body:JSON.stringify({sessionId:'4fe799',runId:'areas-early',hypothesisId:'H-stale-drop',location:'refreshViewport.ts:areasEarly',message:'viewport_areas_mount',data:{zoom,fetchAreas,nAssets:0,nAreas,appendedAreas,fetchMs:Math.round(performance.now()-t0),reason:`${reason}:areas-early`,softStale,userCamera:isUserCameraReason(reason),pendingFit:peekFilterFit(),belowMin:zoom<GREEN_AREAS_VIEWPORT_MIN_ZOOM,sampleNames:(areas.features??[]).slice(0,3).map(f=>String((f.properties as {name?:string}|null)?.name??''))},timestamp:Date.now()})}).catch(()=>{})
    // #endregion
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
    const afterMountedAreas = host.lastGreenGeometries.filter((g) =>
      g.geom_id.startsWith('GA_'),
    ).length
    const stillHasClusters = host.lastGreenGeometries.some(
      (g) =>
        g.geom_id.startsWith('GC_') ||
        g.geom_id.startsWith('GS_') ||
        g.geom_id.includes('\u200B'),
    )
    // #region agent log
    fetch('http://127.0.0.1:7455/ingest/ee4d7135-3aef-4e11-b07a-3de89c3bf62c',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'4fe799'},body:JSON.stringify({sessionId:'4fe799',runId:'zoom-flash',hypothesisId:'H-zoom-flash',location:'refreshViewport.ts:areasEarlyMounted',message:'viewport_areas_after_mount',data:{zoom,afterMountedAreas,appendedAreas,nAreas,softStale,userCamera,preserveAssets:userCamera,stillHasClusters},timestamp:Date.now()})}).catch(()=>{})
    // #endregion
    // Cerca: never fit/zoom/pan the camera (user + debug 4fe799 gold-20 / timeout-z16).
    if ((!userCamera || softStale) && peekFilterFit()) {
      cancelScheduledFilterFitTimers('areas-early-no-fit')
      cancelDeferredCercaFit('areas-early-no-fit')
      consumeFilterFit('cerca-no-camera')
      // #region agent log
      fetch('http://127.0.0.1:7455/ingest/ee4d7135-3aef-4e11-b07a-3de89c3bf62c',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'4fe799'},body:JSON.stringify({sessionId:'4fe799',runId:'cerca-no-cam',hypothesisId:'H-no-fit',location:'refreshViewport.ts:areasEarlyNoFit',message:'cerca_fit_blocked',data:{zoom,nAreas,softStale,reason},timestamp:Date.now()})}).catch(()=>{})
      // #endregion
    }
    areasMountedEarly = true
    markAreasReadyForTable(`${reason}:areas-early`)
    return true
  }

  let transportFail = false
  const assetsPromise = fetcher(bbox, zoom).catch((err: unknown) => {
    transportFail = true
    // #region agent log
    fetch('http://127.0.0.1:7455/ingest/ee4d7135-3aef-4e11-b07a-3de89c3bf62c',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'4fe799'},body:JSON.stringify({sessionId:'4fe799',runId:'villa-clusters',hypothesisId:'H-stale-drop',location:'refreshViewport.ts:assetsCatch',message:'viewport_assets_promise_err',data:{zoom,err:String(err),seq},timestamp:Date.now()})}).catch(()=>{})
    // #endregion
    return EMPTY_FEATURE_COLLECTION
  })

  const areasPromise = (
    fetchAreas
      ? areasFetcher(bbox, zoom)
      : Promise.resolve(EMPTY_FEATURE_COLLECTION)
  ).catch((err: unknown) => {
    transportFail = true
    // #region agent log
    fetch('http://127.0.0.1:7455/ingest/ee4d7135-3aef-4e11-b07a-3de89c3bf62c',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'4fe799'},body:JSON.stringify({sessionId:'4fe799',runId:'villa-clusters',hypothesisId:'H-stale-drop',location:'refreshViewport.ts:areasCatch',message:'viewport_areas_promise_err',data:{zoom,err:String(err),seq},timestamp:Date.now()})}).catch(()=>{})
    // #endregion
    return EMPTY_FEATURE_COLLECTION
  })

  const mountCombined = (
    assets: GeoJSONFeatureCollection,
    areas: GeoJSONFeatureCollection,
    mountReason: string,
    opts: { softStale: boolean },
  ): boolean => {
    const softStale = opts.softStale
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
    // #region agent log
    fetch('http://127.0.0.1:7455/ingest/ee4d7135-3aef-4e11-b07a-3de89c3bf62c',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'4fe799'},body:JSON.stringify({sessionId:'4fe799',runId:'areas-early',hypothesisId:'H-stale-drop',location:'refreshViewport.ts:mountCombined',message:'viewport_areas_mount',data:{zoom,fetchAreas,nAssets,nAreas,appendedAreas,fetchMs:Math.round(performance.now()-t0),reason:mountReason,softStale,belowMin:zoom<GREEN_AREAS_VIEWPORT_MIN_ZOOM,sampleNames:(areas.features??[]).slice(0,3).map(f=>String((f.properties as {name?:string}|null)?.name??''))},timestamp:Date.now()})}).catch(()=>{})
    // #endregion
    mountGreenPayload(host, payload, zoom, {
      rawMode: true,
      fullReplace: mountReason !== APPLY_REASON.panViewport,
      reason: mountReason,
    })
    host.lastAppliedViewportBbox = bbox
    const afterMountedAreas = host.lastGreenGeometries.filter((g) =>
      g.geom_id.startsWith('GA_'),
    ).length
    // #region agent log
    fetch('http://127.0.0.1:7455/ingest/ee4d7135-3aef-4e11-b07a-3de89c3bf62c',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'4fe799'},body:JSON.stringify({sessionId:'4fe799',runId:'areas-early',hypothesisId:'H-stale-drop',location:'refreshViewport.ts:mountCombinedDone',message:'viewport_areas_after_mount',data:{zoom,afterMountedAreas,appendedAreas,nAreas,nAssets,softStale},timestamp:Date.now()})}).catch(()=>{})
    // #endregion
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
      // #region agent log
      fetch('http://127.0.0.1:7455/ingest/ee4d7135-3aef-4e11-b07a-3de89c3bf62c',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'4fe799'},body:JSON.stringify({sessionId:'4fe799',runId:'fit-defer',hypothesisId:'H-fit-defer',location:'refreshViewport.ts:assetsZoomDrift',message:'assets_soft_stale_skip',data:{zoom,zoomNow,zoomDrift,nAssets,seq},timestamp:Date.now()})}).catch(()=>{})
      // #endregion
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
        // #region agent log
        fetch('http://127.0.0.1:7455/ingest/ee4d7135-3aef-4e11-b07a-3de89c3bf62c',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'4fe799'},body:JSON.stringify({sessionId:'4fe799',runId:'loader-stuck',hypothesisId:'H-loader-early',location:'refreshViewport.ts:assetsReadyNoFit',message:'cerca_fit_blocked',data:{zoom,nAssets,softStale,reason},timestamp:Date.now()})}).catch(()=>{})
        // #endregion
      }
    }
  })

  let collection: GeoJSONFeatureCollection
  try {
    ;[collection, areasCollection] = await Promise.all([assetsPromise, areasPromise])
  } catch {
    window.clearTimeout(loadWatchdog)
    endLoadOnce('fetch-error')
    return
  }
  const fetchMs = performance.now() - t0
  const nAssets = collection.features?.length ?? 0
  const nAreas = areasCollection.features?.length ?? 0
  // #region agent log
  fetch('http://127.0.0.1:7455/ingest/ee4d7135-3aef-4e11-b07a-3de89c3bf62c',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'4fe799'},body:JSON.stringify({sessionId:'4fe799',runId:'perf-opt',hypothesisId:'H-opt-viewport-wall',location:'refreshViewport.ts:fetchDone',message:'viewport_fetch_wall',data:{zoom,reason,seq,fetchMs:Math.round(fetchMs),nAssets,nAreas,areasMountedEarly,assetsMountedForSeq,baselineColdMs:14300},timestamp:Date.now()})}).catch(()=>{})
  // #endregion

  if (!isCurrentSeq(host, seq, fetcher)) {
    window.clearTimeout(loadWatchdog)
    endLoadOnce('stale')
    // #region agent log
    fetch('http://127.0.0.1:7455/ingest/ee4d7135-3aef-4e11-b07a-3de89c3bf62c',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'4fe799'},body:JSON.stringify({sessionId:'4fe799',runId:'areas-early',hypothesisId:'H-stale-drop',location:'refreshViewport.ts:stale',message:'viewport_stale_drop',data:{zoom,seq,areasMountedEarly,nAreas,nAssets,fetchMs:Math.round(fetchMs)},timestamp:Date.now()})}).catch(()=>{})
    // #endregion
    // Soft-stale assets already handled in assetsPromise.then.
    return
  }

  // Empty result: retry ONLY on transport failure (NetworkError). Legitimate
  // filter-empty (zril-127+villa → 0 hits) must not retry / hold burst ~100s
  // (debug 4fe799 cerca 3–4).
  if (nAssets === 0 && nAreas === 0) {
    window.clearTimeout(loadWatchdog)
    if (
      reason === 'viewport-load' &&
      transportFail &&
      cercaEmptyRetries < CERCA_EMPTY_RETRY_DELAYS_MS.length
    ) {
      const delay = CERCA_EMPTY_RETRY_DELAYS_MS[cercaEmptyRetries] ?? 8000
      cercaEmptyRetries += 1
      holdViewportBurstMs(delay + 500, 'empty-retry')
      endLoadOnce('empty-retry-sched')
      // #region agent log
      fetch('http://127.0.0.1:7455/ingest/ee4d7135-3aef-4e11-b07a-3de89c3bf62c',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'4fe799'},body:JSON.stringify({sessionId:'4fe799',runId:'post-fix',hypothesisId:'H-empty-ok',location:'refreshViewport.ts:emptyRetry',message:'viewport_empty_retry',data:{zoom,seq,retry:cercaEmptyRetries,delay,transportFail,kept:host.lastGreenGeometries.length},timestamp:Date.now()})}).catch(()=>{})
      // #endregion
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
    // #region agent log
    fetch('http://127.0.0.1:7455/ingest/ee4d7135-3aef-4e11-b07a-3de89c3bf62c',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'4fe799'},body:JSON.stringify({sessionId:'4fe799',runId:'post-fix',hypothesisId:'H-empty-ok',location:'refreshViewport.ts:emptyOk',message:'viewport_empty_ok',data:{zoom,seq,transportFail,reason,kept:host.lastGreenGeometries.length},timestamp:Date.now()})}).catch(()=>{})
    // #endregion
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
    // #region agent log
    fetch('http://127.0.0.1:7455/ingest/ee4d7135-3aef-4e11-b07a-3de89c3bf62c',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'4fe799'},body:JSON.stringify({sessionId:'4fe799',runId:'zoom-fast',hypothesisId:'H-double-mount',location:'refreshViewport.ts:skipRemount',message:'viewport_skip_remount',data:{zoom,seq,nAssets,nAreas,fetchMs:Math.round(fetchMs),reason},timestamp:Date.now()})}).catch(()=>{})
    // #endregion
  }
  if (
    mounted &&
    nAreas > 0 &&
    !areasMountedEarly &&
    !isUserCameraReason(reason) &&
    peekFilterFit()
  ) {
    consumeFilterFit('combined-mount-no-fit')
    // #region agent log
    fetch('http://127.0.0.1:7455/ingest/ee4d7135-3aef-4e11-b07a-3de89c3bf62c',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'4fe799'},body:JSON.stringify({sessionId:'4fe799',runId:'cerca-no-cam',hypothesisId:'H-no-fit',location:'refreshViewport.ts:combinedNoFit',message:'cerca_fit_blocked',data:{zoom,nAreas,nAssets,reason},timestamp:Date.now()})}).catch(()=>{})
    // #endregion
  }

  runAfterGeoinsightVendorOps(host, () => {
    window.clearTimeout(loadWatchdog)
    endLoadOnce('vendor')
  })
}
