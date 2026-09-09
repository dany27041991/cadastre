import { geoJsonToGeoinsightGeometries } from '@/features/territory/lib/geoJsonToGeoinsight'
import { resolveFeatureId } from '@/features/territory/lib/featureIdentity'
import {
  buildGreenAreaGeomId,
  municipalityIdFromProperties,
} from '@/features/territory/lib/greenAreaGeomId'
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

function isAreaGeom(geometry: { geom_id: string }): boolean {
  return geometry.geom_id.startsWith(GEOM_PREFIX.greenArea)
}

/**
 * Root green areas (polygons) → geometry clips + registry entries merged into the
 * viewport payload. Ids are stable (`GA_<muni>_<id>`), so the diff mount adds only
 * areas entering the viewport and removes the ones that left it.
 */
export function appendGreenAreaViewportFeatures(
  payload: GreenClusterLayerPayload,
  areasCollection: GeoJSONFeatureCollection
): number {
  if ((areasCollection.features?.length ?? 0) === 0) return 0
  const { geometries, metas } = geoJsonToGeoinsightGeometries(
    areasCollection,
    GEOM_PREFIX.greenArea,
    {
      color: GREEN_AREA_GEOMETRY_COLOR,
      geomIdForFeature: (properties, id) =>
        buildGreenAreaGeomId(id, municipalityIdFromProperties(properties)),
    }
  )
  // Areas first: polygons render under asset points/clusters (add order = z-order).
  payload.geometries.unshift(...geometries)
  for (const meta of metas) {
    const source = areasCollection.features?.find((f) => {
      const props = (f.properties ?? {}) as Record<string, unknown>
      const fid = resolveFeatureId(props, f.id)
      const muni = municipalityIdFromProperties(props)
      return (
        fid === meta.id &&
        buildGreenAreaGeomId(fid, muni) === meta.geomId
      )
    })
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

  const prevAreaCountBeforeClear = host.lastGreenGeometries.filter(isAreaGeom).length
  if (replaceAssets) {
    clearAssetAndClusterLayerPrefixes(host)
    cancelPanStalePrune(host)
  }

  const prevGeometries = host.lastGreenGeometries
  const nextIds = new Set(payload.geometries.map((geometry) => geometry.geom_id))
  const prevIdSet = new Set(prevGeometries.map((geometry) => geometry.geom_id))
  const payloadHasAreas = payload.geometries.some(isAreaGeom)
  const prevAreas = prevGeometries.filter(isAreaGeom)
  let toAdd = payload.geometries.filter((geometry) => !prevIdSet.has(geometry.geom_id))
  const stale = prevGeometries.filter((geometry) => !nextIds.has(geometry.geom_id))
  let toRemove: string[] = []
  let mountedGeometries = payload.geometries
  let branch = 'full-diff'

  // Payload is source of truth for GA_. Empty payload (zoom < min, areas off,
  // or no areas in bbox) MUST drop previously mounted areas — re-queueing them
  // left polygons stuck on screen after zoom-out below GREEN_AREAS_VIEWPORT_MIN_ZOOM.
  if (!payloadHasAreas && prevAreas.length > 0) {
    toRemove = prevAreas.map((geometry) => geometry.geom_id)
    for (const id of toRemove) {
      host.registry.removeByGeomId(id)
    }
    if (replaceAssets) {
      toAdd = payload.geometries
      mountedGeometries = payload.geometries
      branch = 'clear-areas-replace'
    } else if (meta.reason === APPLY_REASON.panViewport) {
      const prevAssets = prevGeometries.filter((geometry) => !isAreaGeom(geometry))
      const assetNextIds = new Set(payload.geometries.map((geometry) => geometry.geom_id))
      const assetStale = prevAssets.filter((geometry) => !assetNextIds.has(geometry.geom_id))
      const dropCount = panStaleInlineDropCount(assetStale.length)
      const dropped = dropCount > 0 ? assetStale.slice(0, dropCount) : []
      const keptAssetStale = dropCount > 0 ? assetStale.slice(dropCount) : assetStale
      const assetRemove = dropped.map((geometry) => geometry.geom_id)
      for (const id of assetRemove) {
        host.registry.removeByGeomId(id)
      }
      toRemove = [...toRemove, ...assetRemove]
      toAdd = payload.geometries.filter((geometry) => !prevIdSet.has(geometry.geom_id))
      mountedGeometries = [...keptAssetStale, ...payload.geometries]
      if (keptAssetStale.length > 0) schedulePanStalePrune(host)
      branch = 'clear-areas-pan'
    } else {
      toRemove = [
        ...toRemove,
        ...stale.filter((geometry) => !isAreaGeom(geometry)).map((geometry) => geometry.geom_id),
      ]
      for (const id of toRemove) {
        host.registry.removeByGeomId(id)
      }
      mountedGeometries = payload.geometries
      branch = 'clear-areas-diff'
    }
  } else if (!replaceAssets && meta.reason === APPLY_REASON.panViewport) {
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
    branch = 'pan-additive'
  } else {
    toRemove = stale.map((geometry) => geometry.geom_id)
    for (const id of toRemove) {
      host.registry.removeByGeomId(id)
    }
    branch = 'full-diff'
  }

  // Stable GA_/GS_ ids skip remount when only the id matches; if WKT changed
  // (true L/S geom vs point marker, ingest update), force remove+add.
  const prevByGeomId = new Map(
    prevGeometries.map((geometry) => [geometry.geom_id, geometry] as const)
  )
  const remountChanged = payload.geometries.filter((geometry) => {
    const prev = prevByGeomId.get(geometry.geom_id)
    return prev != null && prev.data !== geometry.data
  })
  if (remountChanged.length > 0) {
    const remountIds = remountChanged.map((geometry) => geometry.geom_id)
    const removeSet = new Set(toRemove)
    for (const id of remountIds) {
      if (!removeSet.has(id)) {
        toRemove.push(id)
        host.registry.removeByGeomId(id)
        removeSet.add(id)
      }
    }
    const addSet = new Set(toAdd.map((geometry) => geometry.geom_id))
    for (const geometry of remountChanged) {
      if (!addSet.has(geometry.geom_id)) {
        toAdd.push(geometry)
        addSet.add(geometry.geom_id)
      }
    }
    branch = `${branch}+wkt-remount`
  }

  const mountedAreaCount = mountedGeometries.filter(isAreaGeom).length

  registerPayloadEntries(host, payload)
  setPanCurrentViewportIds(
    host,
    new Set(mountedGeometries.map((geometry) => geometry.geom_id))
  )
  host.lastGreenGeometries = mountedGeometries
  host.lastGreenShowClusterCountLabels = payload.showClusterCountLabels
  host.lastAppliedGreenAssetZoom = zoom
  host.lastAppliedRawMode = rawMode

  if (toRemove.length > 0) host.removeGeomIds(toRemove)
  if (host.greenLayerVisible && toAdd.length > 0) {
    host.addGeometries(toAdd, { showLabels: payload.showClusterCountLabels })
  }
  reassertGreenDetailHighlight(host as unknown as GreenDetailHighlightHost)
}
