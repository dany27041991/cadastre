import { geoJsonToGeoinsightGeometries } from '@/features/territory/lib/geoJsonToGeoinsight'
import { resolveFeatureId } from '@/features/territory/lib/featureIdentity'
import type { GeoJSONFeatureCollection } from '@/shared/types'
import { clusterLabelGeomId } from '../../../lib/clusterCircleGeometry'
import { GEOM_PREFIX, GREEN_AREA_GEOMETRY_COLOR } from '../../constants'
import type { GreenClusterLayerPayload } from '../../greenClusterPipeline'
import { reassertGreenDetailHighlight } from '../geoinsightDetailHighlight'
import type { GreenDetailHighlightHost } from '../geoinsightDetailHighlight'
import { APPLY_REASON, LAYER_KIND } from './constants'
import { clearAssetAndClusterLayerPrefixes } from './clearLayers'
import {
  cancelPanStalePrune,
  panStaleInlineDropCount,
  schedulePanStalePrune,
  setPanCurrentViewportIds,
} from './panStalePrune'
import type { GeoinsightGreenClusterHost } from './types'

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

/**
 * Root green areas (polygons) → geometry clips + registry entries merged into the
 * viewport payload. Ids are stable (`GA_<id>`), so the diff mount adds only areas
 * entering the viewport and removes the ones that left it.
 */
export function appendGreenAreaViewportFeatures(
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
      layerKind: LAYER_KIND.greenArea,
      bbox: meta.bbox,
      properties: source?.properties ?? {},
      geometry: source?.geometry ?? {},
    })
  }
  return geometries.length
}

export function mountGreenPayload(
  host: GeoinsightGreenClusterHost,
  payload: GreenClusterLayerPayload,
  zoom: number,
  meta: { rawMode: boolean; fullReplace?: boolean; reason?: string }
): void {
  const rawMode = meta.rawMode
  // Zoom / mode changes must replace asset+cluster geometries (stale GC_ among
  // raw GS_ otherwise linger). Area polygons (GA_) keep stable ids — wipe+remount
  // of ~500 areas on every zoom was the visual lag.
  const zoomChanged =
    host.lastAppliedGreenAssetZoom == null ||
    Math.abs(zoom - host.lastAppliedGreenAssetZoom) > 1e-6
  const replaceAssets =
    meta.fullReplace === true || rawMode !== host.lastAppliedRawMode || zoomChanged

  if (replaceAssets) {
    clearAssetAndClusterLayerPrefixes(host)
    cancelPanStalePrune(host)
  }

  const prevGeometries = host.lastGreenGeometries
  const nextIds = new Set(payload.geometries.map((geometry) => geometry.geom_id))
  const prevIdSet = new Set(prevGeometries.map((geometry) => geometry.geom_id))
  const payloadHasAreas = payload.geometries.some((geometry) =>
    geometry.geom_id.startsWith(GEOM_PREFIX.greenArea)
  )
  let toAdd = payload.geometries.filter((geometry) => !prevIdSet.has(geometry.geom_id))
  const stale = prevGeometries.filter((geometry) => !nextIds.has(geometry.geom_id))
  let toRemove: string[] = []
  let mountedGeometries = payload.geometries

  // Zoom-only asset refresh omitted areas from the payload — keep GA_ mounted.
  if (replaceAssets && !payloadHasAreas) {
    toAdd = payload.geometries
    toRemove = []
    mountedGeometries = [...prevGeometries, ...payload.geometries]
  } else if (!replaceAssets && meta.reason === APPLY_REASON.panViewport) {
    if (!payloadHasAreas) {
      // Areas intentionally omitted on pan — keep GA_, only diff assets/clusters.
      const isArea = (geometry: { geom_id: string }) =>
        geometry.geom_id.startsWith(GEOM_PREFIX.greenArea)
      const prevAreas = prevGeometries.filter(isArea)
      const prevAssets = prevGeometries.filter((geometry) => !isArea(geometry))
      const assetNextIds = new Set(payload.geometries.map((geometry) => geometry.geom_id))
      const assetStale = prevAssets.filter((geometry) => !assetNextIds.has(geometry.geom_id))
      const dropCount = panStaleInlineDropCount(assetStale.length)
      const dropped = dropCount > 0 ? assetStale.slice(0, dropCount) : []
      const keptAssetStale = dropCount > 0 ? assetStale.slice(dropCount) : assetStale
      toRemove = dropped.map((geometry) => geometry.geom_id)
      for (const id of toRemove) {
        host.registry.removeByGeomId(id)
      }
      toAdd = payload.geometries.filter((geometry) => !prevIdSet.has(geometry.geom_id))
      mountedGeometries = [...prevAreas, ...keptAssetStale, ...payload.geometries]
      if (keptAssetStale.length > 0) schedulePanStalePrune(host)
    } else {
      // Additive pan mount: keep exiting features mounted, prune later in
      // small idle batches (see PAN_STALE_PRUNE_IDLE_MS rationale).
      const dropCount = panStaleInlineDropCount(stale.length)
      const dropped = dropCount > 0 ? stale.slice(0, dropCount) : []
      const keptStale = dropCount > 0 ? stale.slice(dropCount) : stale
      toRemove = dropped.map((geometry) => geometry.geom_id)
      for (const id of toRemove) {
        host.registry.removeByGeomId(id)
      }
      mountedGeometries =
        keptStale.length > 0 ? [...keptStale, ...payload.geometries] : payload.geometries
      if (keptStale.length > 0) schedulePanStalePrune(host)
    }
  } else {
    toRemove = stale.map((geometry) => geometry.geom_id)
    for (const id of toRemove) {
      host.registry.removeByGeomId(id)
    }
  }

  registerPayloadEntries(host, payload)
  setPanCurrentViewportIds(
    host,
    new Set(mountedGeometries.map((geometry) => geometry.geom_id))
  )
  host.lastGreenGeometries = mountedGeometries
  host.lastGreenShowClusterCountLabels = payload.showClusterCountLabels
  host.lastAppliedGreenAssetZoom = zoom
  host.lastAppliedRawMode = rawMode

  if (host.greenLayerVisible && toAdd.length > 0) {
    host.addGeometries(toAdd, { showLabels: payload.showClusterCountLabels })
  }
  if (toRemove.length > 0) host.removeGeomIds(toRemove)
  reassertGreenDetailHighlight(host as unknown as GreenDetailHighlightHost)
}
