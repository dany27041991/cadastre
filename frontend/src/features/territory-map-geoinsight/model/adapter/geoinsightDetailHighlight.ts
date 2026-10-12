/**
 * Temporary red selection style for the green feature in the detail modal.
 *
 * Overlay GH_ polygons/lines sit under remounted GA_/GS_ fills (vendor add OK,
 * user saw only geom_id label). Instead we recolor the mounted GA_/GS_ clip in
 * place and restore it on clear / remount via reassert.
 */
import WKT from 'terraformer-wkt-parser'
import type { TerritoryMapFeature } from '@/features/territory/types/mapFeature'
import type { GeoinsightGeometryClip } from '@/features/territory/lib/geoJsonToGeoinsight'
import {
  buildGreenAreaGeomId,
  buildGreenAssetGeomId,
  municipalityIdFromProperties,
} from '@/features/territory/lib/greenAreaGeomId'
import {
  GEOM_PREFIX,
  GEOINSIGHT_EPSG_WGS84,
  GREEN_AREA_GEOMETRY_COLOR,
  GREEN_DETAIL_HIGHLIGHT_COLOR,
} from '../constants'
import {
  addGeoinsightGeometries,
  removeGeoinsightGeomIds,
  type GeoinsightMapRuntimeHost,
} from './geoinsightMapRuntime'

export type GreenDetailHighlightHost = GeoinsightMapRuntimeHost & {
  detailHighlightGeomIds: string[]
  detailHighlightFeature: TerritoryMapFeature | null
  /** Original green clip to restore when the modal closes. */
  detailHighlightRestoreClip: GeoinsightGeometryClip | null
  /** True when the current selection recolored a clip already on the green layer. */
  detailHighlightUsedMounted: boolean
  lastGreenGeometries?: GeoinsightGeometryClip[]
}

/** Braille blank — prevents Geoinsight falling back to showing geom_id as label. */
const INVISIBLE_LABEL_PREFIX = '\u2800'

const HIDDEN_LABEL = {
  label: INVISIBLE_LABEL_PREFIX,
  geom_label: INVISIBLE_LABEL_PREFIX,
  show_label: false,
  label_visibility: false,
  hide_label: true,
  label_color: '#00000000',
  label_border_color: '#00000000',
} as const

function geometryToWkt(geometry: object): string | null {
  try {
    const wkt = WKT.convert(geometry as Parameters<typeof WKT.convert>[0])
    return typeof wkt === 'string' && wkt.length > 0 ? wkt : null
  } catch {
    return null
  }
}

function findMountedGreenClip(
  host: GreenDetailHighlightHost,
  featureId: number,
  feature?: TerritoryMapFeature | null,
  preferAsset = false
): GeoinsightGeometryClip | null {
  const geometries = host.lastGreenGeometries
  if (!geometries?.length) return null
  const muni = municipalityIdFromProperties(
    (feature?.properties ?? null) as Record<string, unknown> | null
  )
  const areaId = buildGreenAreaGeomId(featureId, muni)
  const assetId = buildGreenAssetGeomId(featureId, muni)
  const byId = (gid: string) => geometries.find((g) => g.geom_id === gid) ?? null
  // Never fall back to the other kind — GA_/GS_ share numeric ids per municipality
  // (debug 4fe799: asset id=2 recolored GA_1_2, then GS_1_2 left GA orphaned red).
  const preferredId = preferAsset ? assetId : areaId
  const preferred = byId(preferredId)
  const otherId = preferAsset ? areaId : assetId
  const otherHit = Boolean(byId(otherId))
  if (preferred) {
    // #region agent log
    fetch('http://127.0.0.1:7455/ingest/ee4d7135-3aef-4e11-b07a-3de89c3bf62c',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'4fe799'},body:JSON.stringify({sessionId:'4fe799',runId:'asset-vs-area',hypothesisId:'H-clip-collision',location:'geoinsightDetailHighlight:findMounted',message:'highlight_clip_match',data:{featureId,muni,preferAsset,areaId,assetId,matched:preferred.geom_id,preferredHit:true,otherHit,wrongKind:false},timestamp:Date.now()})}).catch(()=>{})
    // #endregion
    return preferred
  }
  // Legacy only for the requested kind prefix.
  const legacyPref = preferAsset ? GEOM_PREFIX.greenAsset : GEOM_PREFIX.greenArea
  const legacy =
    geometries.find(
      (g) =>
        g.geom_id === `${legacyPref}${featureId}` ||
        (g.geom_id.startsWith(legacyPref) && g.geom_id.endsWith(`_${featureId}`))
    ) ?? null
  // #region agent log
  fetch('http://127.0.0.1:7455/ingest/ee4d7135-3aef-4e11-b07a-3de89c3bf62c',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'4fe799'},body:JSON.stringify({sessionId:'4fe799',runId:'asset-vs-area',hypothesisId:'H-clip-collision',location:'geoinsightDetailHighlight:findMounted',message:'highlight_clip_match',data:{featureId,muni,preferAsset,areaId,assetId,matched:legacy?.geom_id??null,preferredHit:false,otherHit,wrongKind:false,miss:true},timestamp:Date.now()})}).catch(()=>{})
  // #endregion
  return legacy
}

function withRedSelection(clip: GeoinsightGeometryClip): GeoinsightGeometryClip {
  return {
    ...clip,
    color: GREEN_DETAIL_HIGHLIGHT_COLOR,
    // Emphasize perimeter on surfaces/lines.
    stroke_width: 5,
    width: 5,
    ...HIDDEN_LABEL,
  }
}

function fallbackClipFromFeature(
  feature: TerritoryMapFeature,
  preferAsset: boolean
): GeoinsightGeometryClip | null {
  const wkt = geometryToWkt(feature.geometry)
  if (!wkt || !Number.isFinite(feature.id)) return null
  const muni = municipalityIdFromProperties(
    feature.properties as Record<string, unknown>
  )
  const geom_id = preferAsset
    ? buildGreenAssetGeomId(feature.id, muni)
    : buildGreenAreaGeomId(feature.id, muni)
  return {
    type: 'WKT',
    data: wkt,
    geom_id,
    epsg: GEOINSIGHT_EPSG_WGS84,
    color: GREEN_DETAIL_HIGHLIGHT_COLOR,
    stroke_width: 5,
    width: 5,
    ...HIDDEN_LABEL,
  }
}

function patchLastGreenColor(
  host: GreenDetailHighlightHost,
  geomId: string,
  color: string | [number, number, number, number]
): void {
  const list = host.lastGreenGeometries
  if (!list?.length) return
  const idx = list.findIndex((g) => g.geom_id === geomId)
  if (idx < 0) return
  list[idx] = { ...list[idx], color }
}

function applySelectionRecolor(
  host: GreenDetailHighlightHost,
  feature: TerritoryMapFeature,
  preferAsset = false
): { geomId: string; usedMounted: boolean; wktLen: number } | null {
  const mounted = findMountedGreenClip(host, feature.id, feature, preferAsset)
  const redClip = mounted
    ? withRedSelection(mounted)
    : fallbackClipFromFeature(feature, preferAsset)
  if (!redClip) return null

  const prevGeomId = host.detailHighlightGeomIds[0] ?? null
  // Same feature id can switch GA_↔GS_ (or remount) — always restore the previous
  // red clip first or it stays highlighted (debug 4fe799: GA_1_2 orphaned).
  if (prevGeomId && prevGeomId !== redClip.geom_id) {
    restoreSelectionColor(host)
  }

  // Keep the first-captured green clip across reassert/re-set (cache is already red).
  const restore =
    host.detailHighlightRestoreClip?.geom_id === redClip.geom_id
      ? host.detailHighlightRestoreClip
      : mounted
        ? {
            ...mounted,
            // Mounted may already be patched red — restore must use green default.
            color: GREEN_AREA_GEOMETRY_COLOR,
            stroke_width: undefined,
            width: undefined,
          }
        : {
            ...redClip,
            color: GREEN_AREA_GEOMETRY_COLOR,
            stroke_width: undefined,
            width: undefined,
          }

  host.detailHighlightRestoreClip = restore
  host.detailHighlightGeomIds = [redClip.geom_id]
  host.detailHighlightFeature = feature
  host.detailHighlightUsedMounted = Boolean(mounted)

  // Patch cache so viewport/sync remounts keep the red selection.
  patchLastGreenColor(host, redClip.geom_id, GREEN_DETAIL_HIGHLIGHT_COLOR)

  removeGeoinsightGeomIds([redClip.geom_id], host)
  addGeoinsightGeometries(host, [redClip])
  // #region agent log
  fetch('http://127.0.0.1:7455/ingest/ee4d7135-3aef-4e11-b07a-3de89c3bf62c',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'4fe799'},body:JSON.stringify({sessionId:'4fe799',runId:'asset-vs-area',hypothesisId:'H-orphan-red',location:'geoinsightDetailHighlight:apply',message:'highlight_apply',data:{featureId:feature.id,preferAsset,geomId:redClip.geom_id,prevGeomId,usedMounted:Boolean(mounted),switched:Boolean(prevGeomId&&prevGeomId!==redClip.geom_id)},timestamp:Date.now()})}).catch(()=>{})
  // #endregion
  return {
    geomId: redClip.geom_id,
    usedMounted: Boolean(mounted),
    wktLen: redClip.data.length,
  }
}

function restoreSelectionColor(host: GreenDetailHighlightHost): void {
  const restore = host.detailHighlightRestoreClip
  const ids = host.detailHighlightGeomIds
  const usedMounted = host.detailHighlightUsedMounted
  host.detailHighlightGeomIds = []
  host.detailHighlightRestoreClip = null
  host.detailHighlightFeature = null
  host.detailHighlightUsedMounted = false
  if (!restore) {
    if (ids.length) removeGeoinsightGeomIds(ids, host)
    return
  }
  if (!usedMounted) {
    // Fallback overlay was never part of the green layer — just remove it.
    removeGeoinsightGeomIds([restore.geom_id], host)
    return
  }
  patchLastGreenColor(host, restore.geom_id, restore.color ?? GREEN_AREA_GEOMETRY_COLOR)
  removeGeoinsightGeomIds([restore.geom_id], host)
  addGeoinsightGeometries(host, [restore])
}

export function clearGreenDetailHighlight(host: GreenDetailHighlightHost): void {
  restoreSelectionColor(host)
}

/**
 * Drop selection without re-adding a restore clip (e.g. leaving to Monitoraggio
 * while clearing the whole green layer).
 */
export function discardGreenDetailHighlight(host: GreenDetailHighlightHost): void {
  const ids = [...host.detailHighlightGeomIds]
  host.detailHighlightGeomIds = []
  host.detailHighlightRestoreClip = null
  host.detailHighlightFeature = null
  host.detailHighlightUsedMounted = false
  if (ids.length) removeGeoinsightGeomIds(ids, host)
}

/**
 * After green remounts: keep the selected feature red if the modal is still open.
 */
export function reassertGreenDetailHighlight(host: GreenDetailHighlightHost): void {
  const feature = host.detailHighlightFeature
  if (!feature) return
  const preferAsset = feature.properties?.__greenKind === 'asset'
  applySelectionRecolor(host, feature, preferAsset === true)
}

export function setGreenDetailHighlight(
  host: GreenDetailHighlightHost,
  feature: TerritoryMapFeature,
  options?: { preferAsset?: boolean }
): void {
  const preferAsset = options?.preferAsset === true
  const prev = host.detailHighlightFeature
  // Clear whenever selection identity OR kind changes (id alone is not unique
  // across area/asset). Same-id reassert is handled inside applySelectionRecolor.
  if (
    prev &&
    (prev.id !== feature.id ||
      prev.properties?.__greenKind !== feature.properties?.__greenKind)
  ) {
    restoreSelectionColor(host)
  }

  applySelectionRecolor(host, feature, preferAsset)
}
