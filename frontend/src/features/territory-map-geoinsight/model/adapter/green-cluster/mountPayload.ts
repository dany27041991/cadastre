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
import { markPerfScan } from '@/features/territory/lib/perfScan'

function registerPayloadEntries(
  host: GeoinsightGreenClusterHost,
  payload: GreenClusterLayerPayload
): void {
  for (const entry of payload.registryEntries) {
    host.registry.register(entry)
    // Alias for any labeled cluster (incl. count=1) so hide/clear removes
    // "N\u200BGC_…" vendor geoms (debug 4fe799 toggle left orphan counts).
    if (
      payload.showClusterCountLabels &&
      entry.isCluster &&
      (entry.memberCount ?? 0) >= 1
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
  // Thin/sliver MultiPolygons are easy to miss without a stroke.
  for (const geometry of geometries) {
    geometry.stroke_width = 3
  }
  // Areas first: polygons render under asset points/clusters (add order = z-order).
  payload.geometries.unshift(...geometries)
  // #region agent log
  fetch('http://127.0.0.1:7455/ingest/ee4d7135-3aef-4e11-b07a-3de89c3bf62c',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'4fe799'},body:JSON.stringify({sessionId:'4fe799',runId:'persist',hypothesisId:'H-wkt',location:'mountPayload.appendGreenAreaViewportFeatures',message:'areas_appended',data:{nIn:areasCollection.features?.length??0,nGeom:geometries.length,nMeta:metas.length,sample:metas.slice(0,3).map((m,i)=>({geomId:m.geomId,id:m.id,label:m.label,bbox:m.bbox,wktLen:(geometries[i]?.data??'').length,wktHead:String(geometries[i]?.data??'').slice(0,100)}))},timestamp:Date.now()})}).catch(()=>{})
  // #endregion
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
  meta: {
    rawMode: boolean
    fullReplace?: boolean
    reason?: string
    /** Keep GC_/GS_ while mounting areas-only (zoom flash — debug 4fe799). */
    preserveAssets?: boolean
  }
): void {
  const tMount0 = performance.now()
  const rawMode = meta.rawMode
  // Zoom / mode changes must replace asset+cluster geometries (stale GC_ among
  // raw GS_ otherwise linger). Area polygons (GA_) keep stable ids — wipe+remount
  // of ~500 areas on every zoom was the visual lag.
  const zoomChanged =
    host.lastAppliedGreenAssetZoom == null ||
    Math.abs(zoom - host.lastAppliedGreenAssetZoom) > 1e-6
  const replaceAssets =
    meta.preserveAssets === true
      ? false
      : meta.fullReplace === true ||
        rawMode !== host.lastAppliedRawMode ||
        zoomChanged

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
  const prevAssets = prevGeometries.filter((geometry) => !isAreaGeom(geometry))
  let toAdd = payload.geometries.filter((geometry) => !prevIdSet.has(geometry.geom_id))
  const stale = prevGeometries.filter((geometry) => !nextIds.has(geometry.geom_id))
  let toRemove: string[] = []
  let mountedGeometries = payload.geometries
  let branch = 'full-diff'

  // Areas-only mount during zoom/pan: update GA_ but keep existing GC_/GS_
  // until the assets fetch completes (debug 4fe799 cluster flash).
  if (meta.preserveAssets === true) {
    const staleAreas = stale.filter(isAreaGeom)
    toRemove = staleAreas.map((geometry) => geometry.geom_id)
    for (const id of toRemove) {
      host.registry.removeByGeomId(id)
    }
    toAdd = payload.geometries.filter((geometry) => !prevIdSet.has(geometry.geom_id))
    mountedGeometries = [...prevAssets, ...payload.geometries]
    branch = 'preserve-assets'
  } else if (!payloadHasAreas && prevAreas.length > 0) {
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
  const toAddAreas = toAdd.filter(isAreaGeom)
  const gaSample = toAddAreas.slice(0, 3).map((g) => ({
    id: g.geom_id,
    wktLen: (g.data ?? '').length,
    wktHead: String(g.data ?? '').slice(0, 80),
    color: g.color,
  }))

  registerPayloadEntries(host, payload)
  setPanCurrentViewportIds(
    host,
    new Set(mountedGeometries.map((geometry) => geometry.geom_id))
  )
  // Areas-early / preserveAssets payloads often have no clusters →
  // showClusterCountLabels=false. Must NOT turn vendor labels off while GC_
  // circles are still mounted (debug 4fe799: zoom kills the count number).
  const prevShowLabels = host.lastGreenShowClusterCountLabels
  const effectiveShowLabels =
    payload.showClusterCountLabels ||
    (meta.preserveAssets === true &&
      prevShowLabels === true &&
      prevAssets.length > 0)
  host.lastGreenGeometries = mountedGeometries
  host.lastGreenShowClusterCountLabels = effectiveShowLabels
  host.lastAppliedGreenAssetZoom = zoom
  host.lastAppliedRawMode = rawMode

  const willAdd =
    host.greenLayerVisible === true && toAdd.length > 0
  // Always sync label visibility after a replace that drops clusters — even
  // when toAdd is empty (debug 4fe799: toggle off left "20" text on map).
  const syncLabels =
    replaceAssets || willAdd || effectiveShowLabels === false || meta.preserveAssets === true
  // #region agent log
  const mountedClusters = mountedGeometries.filter((g) => !isAreaGeom(g)).length
  const payloadClusterEntries = (payload.registryEntries ?? []).filter(
    (e) => e.layerKind === 'cluster' || e.isCluster === true,
  )
  const payloadSumClusterCount = payloadClusterEntries.reduce(
    (s, e) => s + (Number(e.memberCount) || 0),
    0,
  )
  const payloadRawAssets = (payload.registryEntries ?? []).filter(
    (e) => e.layerKind === 'green_asset',
  ).length
  const labelIdsOnHost = mountedGeometries
    .map((g) => g.geom_id)
    .filter((id) => id.includes('\u200B'))
  fetch('http://127.0.0.1:7455/ingest/ee4d7135-3aef-4e11-b07a-3de89c3bf62c',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'4fe799'},body:JSON.stringify({sessionId:'4fe799',runId:'toggle-labels',hypothesisId:'H-zoom-labels',location:'mountPayload.mountGreenPayload',message:'mount_diff',data:{zoom,reason:meta.reason??null,branch,greenLayerVisible:host.greenLayerVisible,willAdd,toAdd:toAdd.length,toAddAreas:toAddAreas.length,toRemove:toRemove.length,mountedAreaCount,mountedClusters,payloadHasAreas,prevAreaCountBeforeClear,gaSample,replaceAssets,preserveAssets:meta.preserveAssets===true,payloadNClusters:payloadClusterEntries.length,payloadSumClusterCount,payloadRawAssets,rawMode,syncLabels,showClusterCountLabels:payload.showClusterCountLabels,effectiveShowLabels,prevShowLabels,labelIdsOnHost:labelIdsOnHost.slice(0,5),sampleClusterCounts:payloadClusterEntries.slice(0,5).map(e=>({geomId:e.geomId,count:e.memberCount,label:e.label}))},timestamp:Date.now()})}).catch(()=>{})
  // #endregion

  if (toRemove.length > 0) host.removeGeomIds(toRemove)
  if (willAdd) {
    host.addGeometries(toAdd, { showLabels: effectiveShowLabels })
  } else if (syncLabels) {
    host.addGeometries([], { showLabels: effectiveShowLabels })
  }
  reassertGreenDetailHighlight(host as unknown as GreenDetailHighlightHost)
  markPerfScan('mount_payload', {
    zoom,
    reason: meta.reason ?? null,
    branch,
    ms: Math.round(performance.now() - tMount0),
    toAdd: toAdd.length,
    toRemove: toRemove.length,
    mountedClusters,
    mountedAreaCount,
  })
}
