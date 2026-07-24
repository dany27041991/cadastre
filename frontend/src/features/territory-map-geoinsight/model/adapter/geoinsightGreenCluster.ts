import { useGeoinsightStore } from '@/app/store/useGeoinsightStore'
import { GREEN_CLUSTER_ZOOM_OVERVIEW } from '@/features/territory/lib/greenAssetClusterCore'
import type { GeoJSONFeatureCollection } from '@/shared/types'
import {
  buildGreenClusterLayerPayload,
  serverViewportCollectionToDisplayItems,
  viewportClusterZoom,
  type GreenClusterLayerPayload,
} from '../greenClusterPipeline'
import { parseZoomFromCenterScale } from '../parseMapZoom'
import { GEOM_PREFIX, GREEN_AREA_GEOMETRY_COLOR } from '../constants'
import { geoJsonToGeoinsightGeometries } from '@/features/territory/lib/geoJsonToGeoinsight'
import { resolveFeatureId } from '@/features/territory/lib/featureIdentity'
import { clusterLabelGeomId } from '../../lib/clusterCircleGeometry'
import { viewportBboxFromMapStatus, viewportBboxMovedEnough } from '../../lib/mapViewportBbox'
import type { GeoinsightAdapterHost } from './geoinsightAdapterHost'
import {
  getGeoinsightMapId,
  getGeoinsightRef,
  runAfterGeoinsightVendorOps,
} from './geoinsightMapRuntime'

/** Fetches viewport-sized data from the server (bbox+zoom → raw assets or clusters). */
export type GreenViewportFetcher = (
  bbox: [number, number, number, number],
  zoom: number
) => Promise<GeoJSONFeatureCollection>

export interface GeoinsightGreenClusterHost extends GeoinsightAdapterHost {
  greenAssetClusteringActive: boolean
  lastAppliedGreenAssetZoom: number | null
  lastGreenShowClusterCountLabels: boolean
  lastAppliedViewportBbox: [number, number, number, number] | null
  lastAppliedRawMode: boolean
  /** Server viewport mode: when set, data comes per-bbox from the backend. */
  greenViewportFetcher: GreenViewportFetcher | null
  /** Optional companion fetcher: root green areas (polygons) per bbox+zoom. */
  greenViewportAreasFetcher: GreenViewportFetcher | null
  /** Monotonic id to drop stale viewport responses (out-of-order fetches). */
  greenViewportRequestSeq: number
}

/**
 * Below this zoom the areas layer is not rendered (admin/grid clusters cover
 * those bands); mirrors VIEWPORT_AREAS_MIN_ZOOM on the backend.
 */
const GREEN_AREAS_VIEWPORT_MIN_ZOOM = 12

const EMPTY_FEATURE_COLLECTION: GeoJSONFeatureCollection = {
  type: 'FeatureCollection',
  features: [],
}

// Pan refreshes are diff-mounted and chunked (cheap); the upstream pan debounce
// already coalesces movement, so this stage only needs to absorb bursts.
const RAW_CLUSTER_APPLY_DEBOUNCE_MS = 40
/**
 * Zoom steps are detected by the 120ms poll, so an 80ms debounce fired on every
 * intermediate discrete level during continuous zoom (debug logs: full rebuilds of
 * 878-1066 geometries per step while the vendor was still animating). 200ms > poll
 * interval coalesces the steps; only the settle level is mounted.
 */
const RAW_ZOOM_APPLY_DEBOUNCE_MS = 200
const rawApplyTimers = new WeakMap<
  GeoinsightGreenClusterHost,
  ReturnType<typeof setTimeout>
>()
const rawApplyReasons = new WeakMap<GeoinsightGreenClusterHost, string>()

/**
 * Viewport refreshes are deferred while a map drag is in progress and coalesced
 * into a single cycle on pointer release. Each refresh allocates heavily
 * (geobuf decode, payload rebuild, vendor re-index of hundreds of geometries):
 * running several cycles mid-gesture piled up garbage until Firefox paused the
 * main thread 1-2s with a major GC, freezing the drag (proven by GC
 * finalization bursts coinciding with the frame stalls, debug session 4fe799).
 */
let mapPointerDragActive = false
let dragDeferredApply: (() => void) | null = null
if (typeof window !== 'undefined') {
  window.addEventListener(
    'pointerdown',
    (event) => {
      if ((event.target as HTMLElement | null)?.closest?.('canvas')) {
        mapPointerDragActive = true
      }
    },
    { capture: true, passive: true }
  )
  const releaseDrag = () => {
    mapPointerDragActive = false
    const run = dragDeferredApply
    dragDeferredApply = null
    run?.()
  }
  window.addEventListener('pointerup', releaseDrag, { capture: true, passive: true })
  window.addEventListener('pointercancel', releaseDrag, { capture: true, passive: true })
}

function scheduleRawClusterApply(host: GeoinsightGreenClusterHost, reason: string): void {
  const pending = rawApplyTimers.get(host)
  const pendingReason = rawApplyReasons.get(host)
  // A pan bump must not cancel an in-flight zoom settle: zoom-out keeps the
  // map center fixed, so the pan path often no-ops after cancelling the zoom
  // timer — clusters would never recalc on the Geoinsight +/- buttons.
  if (
    pending != null &&
    pendingReason === 'raw-zoom-change' &&
    reason !== 'raw-zoom-change'
  ) {
    return
  }
  const effectiveReason =
    pendingReason === 'raw-zoom-change' || reason === 'raw-zoom-change'
      ? 'raw-zoom-change'
      : reason
  const debounceMs =
    effectiveReason === 'raw-zoom-change'
      ? RAW_ZOOM_APPLY_DEBOUNCE_MS
      : RAW_CLUSTER_APPLY_DEBOUNCE_MS
  if (pending != null) clearTimeout(pending)
  rawApplyReasons.set(host, effectiveReason)
  rawApplyTimers.set(
    host,
    setTimeout(() => {
      rawApplyTimers.delete(host)
      rawApplyReasons.delete(host)
      const run = () => {
        if (!host.greenAssetClusteringActive) return
        // Re-read the zoom at execution time: the view-change and zoom-change
        // paths share this timer, so a pan bump fired during a zoom animation
        // could execute with the zoom captured mid-animation and mount the
        // wrong display level (cluster circles left visible at the last zoom).
        void refreshGreenViewport(host, readCurrentGreenClusterZoom(), effectiveReason)
      }
      if (mapPointerDragActive) {
        // Coalesce: only the latest apply survives; it runs on pointer release.
        dragDeferredApply = run
        return
      }
      run()
    }, debounceMs)
  )
}

function registerPayloadEntries(
  host: GeoinsightGreenClusterHost,
  payload: GreenClusterLayerPayload
): void {
  for (const entry of payload.registryEntries) {
    host.registry.register(entry)
    if (
      payload.showClusterCountLabels &&
      entry.isCluster &&
      (entry.memberCount ?? 0) > 1
    ) {
      host.registry.registerAlias(
        clusterLabelGeomId(entry.memberCount ?? 0, entry.geomId),
        entry.geomId
      )
    }
  }
}

export function resetGreenAssetClusterState(host: GeoinsightGreenClusterHost): void {
  host.greenAssetClusteringActive = false
  host.lastAppliedGreenAssetZoom = null
  host.lastGreenGeometries = []
  host.lastGreenShowClusterCountLabels = false
  host.lastAppliedViewportBbox = null
  host.lastAppliedRawMode = false
  host.greenViewportFetcher = null
  host.greenViewportAreasFetcher = null
  host.greenViewportRequestSeq += 1
  const rawPending = rawApplyTimers.get(host)
  if (rawPending != null) clearTimeout(rawPending)
  rawApplyTimers.delete(host)
  rawApplyReasons.delete(host)
  cancelPanStalePrune(host)
}

export function clearGreenLayerPrefixes(host: GeoinsightGreenClusterHost): string[] {
  const clipIds = host.lastGreenGeometries.map((geometry) => geometry.geom_id)
  const ids = [
    ...new Set([
      ...clipIds,
      ...host.registry.removeByPrefix(GEOM_PREFIX.greenArea),
      ...host.registry.removeByPrefix(GEOM_PREFIX.greenAsset),
      ...host.registry.removeByLayerKind('cluster'),
    ]),
  ]
  host.removeGeomIds(ids)
  return ids
}

/**
 * Additive pan mounting. Removing hundreds of geometries on every pan cycle
 * made the vendor discard its parsed geometry graphs each time; the resulting
 * allocation churn triggered 1-2s Firefox major-GC pauses that froze the drag
 * (debug session 4fe799: GC finalization bursts coincide with every stall,
 * removes of 100-800 per cycle). During pan we only add entering features and
 * keep the exiting ones mounted; they are pruned in one rare batch when the
 * map has been still for a moment (or immediately past a hard budget).
 */
// 1.5s idle pruning fired inside the user's natural pause between two drags,
// so the remove churn (and its GC pause) landed right as they resumed panning
// (run post-fix-gc-v2: gaps of 2.4-3.4s right after prunes of 200-640). Prune
// only after the map has been still for a while, in small batches spaced out
// so each one produces little garbage (absorbed by minor GC instead of a
// multi-second major pause), and only once enough stale features accumulated.
const PAN_STALE_PRUNE_IDLE_MS = 6000
const PAN_STALE_PRUNE_REPEAT_MS = 2000
const PAN_STALE_PRUNE_BATCH = 200
const PAN_STALE_PRUNE_MIN = 400
// Inline overflow drops must stay small too: hyper-dense screens pushed the
// stale set over budget by 700+ in one cycle and the resulting bulk remove
// re-triggered the GC pause (run post-fix-gc-v3: 2050ms gap after remove:396,
// drops up to 935). Let the stale set temporarily exceed the budget instead.
const PAN_STALE_FORCE_DROP_MAX = 400
// Hard bound on offscreen leftovers: above this the render cost of the vendor
// canvas (which redraws every mounted feature per frame) outweighs GC savings.
const PAN_STALE_FORCE_PRUNE_AT = 800
const panStalePruneTimers = new WeakMap<
  GeoinsightGreenClusterHost,
  ReturnType<typeof setTimeout>
>()
const panCurrentViewportIds = new WeakMap<GeoinsightGreenClusterHost, Set<string>>()

function cancelPanStalePrune(host: GeoinsightGreenClusterHost): void {
  const pending = panStalePruneTimers.get(host)
  if (pending != null) clearTimeout(pending)
  panStalePruneTimers.delete(host)
}

function prunePanStaleGeometries(host: GeoinsightGreenClusterHost): void {
  const currentIds = panCurrentViewportIds.get(host)
  if (currentIds == null) return
  const stale = host.lastGreenGeometries.filter((g) => !currentIds.has(g.geom_id))
  // Small stale sets stay mounted: an offscreen leftover is harmless, while
  // every removal batch risks a GC pause. Zoom/mode changes full-replace anyway.
  if (stale.length < PAN_STALE_PRUNE_MIN) return
  const batch = stale.slice(0, PAN_STALE_PRUNE_BATCH)
  const batchIds = new Set(batch.map((g) => g.geom_id))
  for (const id of batchIds) host.registry.removeByGeomId(id)
  host.lastGreenGeometries = host.lastGreenGeometries.filter((g) => !batchIds.has(g.geom_id))
  host.removeGeomIds([...batchIds])
  if (stale.length - batch.length >= PAN_STALE_PRUNE_MIN) {
    schedulePanStalePrune(host, PAN_STALE_PRUNE_REPEAT_MS)
  }
}

function schedulePanStalePrune(
  host: GeoinsightGreenClusterHost,
  delayMs: number = PAN_STALE_PRUNE_IDLE_MS
): void {
  cancelPanStalePrune(host)
  panStalePruneTimers.set(
    host,
    setTimeout(() => {
      panStalePruneTimers.delete(host)
      if (!host.greenAssetClusteringActive) return
      if (mapPointerDragActive) {
        schedulePanStalePrune(host)
        return
      }
      prunePanStaleGeometries(host)
    }, delayMs)
  )
}

function mountGreenPayload(
  host: GeoinsightGreenClusterHost,
  payload: GreenClusterLayerPayload,
  zoom: number,
  meta: { rawMode: boolean; fullReplace?: boolean; reason?: string }
): void {
  const rawMode = meta.rawMode
  // A zoom change must always full-replace: a pan-viewport mount that lands at
  // a different zoom than the previous one (pan bump during a zoom animation)
  // otherwise kept the previous level's geometries as additive "stale", leaving
  // cluster circles visible among raw assets at the last zoom level.
  const zoomChanged =
    host.lastAppliedGreenAssetZoom == null ||
    Math.abs(zoom - host.lastAppliedGreenAssetZoom) > 1e-6
  const fullReplace =
    meta.fullReplace === true || rawMode !== host.lastAppliedRawMode || zoomChanged

  let toAdd = payload.geometries
  let toRemove: string[] = []
  let mountedGeometries = payload.geometries
  if (fullReplace) {
    clearGreenLayerPrefixes(host)
    cancelPanStalePrune(host)
  } else {
    const prevGeometries = host.lastGreenGeometries
    const nextIds = new Set(payload.geometries.map((geometry) => geometry.geom_id))
    const prevIdSet = new Set(prevGeometries.map((geometry) => geometry.geom_id))
    toAdd = payload.geometries.filter((geometry) => !prevIdSet.has(geometry.geom_id))
    const stale = prevGeometries.filter((geometry) => !nextIds.has(geometry.geom_id))
    if (meta.reason === 'pan-viewport') {
      // Additive pan mount: keep exiting features mounted, prune later in
      // small idle batches (see PAN_STALE_PRUNE_IDLE_MS rationale above).
      // Past the hard budget only the bounded overflow is dropped inline:
      // removing the whole stale set at once was the original GC trigger.
      const dropCount =
        stale.length > PAN_STALE_FORCE_PRUNE_AT
          ? Math.min(
              stale.length - PAN_STALE_FORCE_PRUNE_AT + PAN_STALE_PRUNE_BATCH,
              PAN_STALE_FORCE_DROP_MAX
            )
          : 0
      const dropped = dropCount > 0 ? stale.slice(0, dropCount) : []
      const keptStale = dropCount > 0 ? stale.slice(dropCount) : stale
      toRemove = dropped.map((geometry) => geometry.geom_id)
      for (const id of toRemove) {
        host.registry.removeByGeomId(id)
      }
      mountedGeometries =
        keptStale.length > 0 ? [...keptStale, ...payload.geometries] : payload.geometries
      if (keptStale.length > 0) schedulePanStalePrune(host)
    } else {
      toRemove = stale.map((geometry) => geometry.geom_id)
      for (const id of toRemove) {
        host.registry.removeByGeomId(id)
      }
    }
  }

  registerPayloadEntries(host, payload)
  panCurrentViewportIds.set(host, new Set(payload.geometries.map((g) => g.geom_id)))
  host.lastGreenGeometries = mountedGeometries
  host.lastGreenShowClusterCountLabels = payload.showClusterCountLabels
  host.lastAppliedGreenAssetZoom = zoom
  host.lastAppliedRawMode = rawMode

  // Adds before removes on diff mounts: the user is waiting for edge assets to
  // appear, while removed ids are already off-screen (add/remove sets are disjoint,
  // so ordering is safe; the vendor op queue keeps FIFO order).
  if (host.greenLayerVisible && toAdd.length > 0) {
    host.addGeometries(toAdd, { showLabels: payload.showClusterCountLabels })
  }
  if (toRemove.length > 0) host.removeGeomIds(toRemove)
}

/**
 * Root green areas (polygons) → geometry clips + registry entries merged into the
 * viewport payload. Ids are stable (`GA_<id>`), so the diff mount adds only areas
 * entering the viewport and removes the ones that left it.
 */
function appendGreenAreaViewportFeatures(
  payload: GreenClusterLayerPayload,
  areasCollection: GeoJSONFeatureCollection
): number {
  if ((areasCollection.features?.length ?? 0) === 0) return 0
  const { geometries, metas } = geoJsonToGeoinsightGeometries(
    areasCollection,
    GEOM_PREFIX.greenArea,
    { color: GREEN_AREA_GEOMETRY_COLOR }
  )
  // Areas first: polygons render under asset points/clusters (add order = z-order).
  payload.geometries.unshift(...geometries)
  for (const meta of metas) {
    const source = areasCollection.features?.find(
      (f) => resolveFeatureId(f.properties ?? {}, f.id) === meta.id
    )
    payload.registryEntries.push({
      id: meta.id,
      label: meta.label,
      geomId: meta.geomId,
      layerKind: 'green_area',
      bbox: meta.bbox,
      properties: source?.properties ?? {},
      geometry: source?.geometry ?? {},
    })
  }
  return geometries.length
}

/**
 * Server viewport mode: fetch bbox+zoom-sized data (raw assets or PostGIS grid
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
  if (bbox == null) {
    return
  }

  const seq = ++host.greenViewportRequestSeq
  const areasFetcher = host.greenViewportAreasFetcher
  const fetchAreas = areasFetcher != null && zoom >= GREEN_AREAS_VIEWPORT_MIN_ZOOM
  let collection: GeoJSONFeatureCollection
  let areasCollection: GeoJSONFeatureCollection
  // Loading indicator: main-thread render load can delay fetch resolution well
  // past the server time (measured 2s worst case), so the user needs feedback.
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
    fullReplace: reason !== 'pan-viewport',
    reason,
  })
  host.lastAppliedViewportBbox = bbox
  // The heavy phase is not the fetch but the vendor processing of the queued
  // mount ops (and the GC it triggers): keep the loading indicator up until
  // the vendor op queue has drained, so heavy screens show "Caricamento"
  // instead of a silently stuck map.
  runAfterGeoinsightVendorOps(host, () => {
    useGeoinsightStore.getState().endGreenViewportLoad()
  })
}

export function readCurrentGreenClusterZoom(): number {
  return (
    useGeoinsightStore.getState().mapZoom ??
    parseZoomFromCenterScale(getGeoinsightRef()?.getCenterAndScale?.(getGeoinsightMapId())) ??
    GREEN_CLUSTER_ZOOM_OVERVIEW
  )
}

export function onGreenAssetMapZoomChange(host: GeoinsightGreenClusterHost, zoom: number): void {
  if (!host.greenAssetClusteringActive || host.greenViewportFetcher == null) {
    return
  }
  // Server viewport mode: every settled zoom step refetches; the 0.35 guard
  // absorbs the vendor's fractional zoom jitter during animations.
  if (
    host.lastAppliedGreenAssetZoom != null &&
    Math.abs(zoom - host.lastAppliedGreenAssetZoom) < 0.35
  ) {
    return
  }
  scheduleRawClusterApply(host, 'raw-zoom-change')
}

export function onGreenAssetMapViewChange(host: GeoinsightGreenClusterHost): void {
  if (!host.greenAssetClusteringActive || host.greenViewportFetcher == null) return

  const mapStatus = getGeoinsightRef()?.getCenterAndScale?.(getGeoinsightMapId())
  const bbox = viewportBboxFromMapStatus(mapStatus)
  if (bbox == null) return

  if (
    host.lastAppliedViewportBbox != null &&
    !viewportBboxMovedEnough(host.lastAppliedViewportBbox, bbox)
  ) {
    return
  }

  scheduleRawClusterApply(host, 'pan-viewport')
}
