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
  featureId: number
): GeoinsightGeometryClip | null {
  const geometries = host.lastGreenGeometries
  if (!geometries?.length) return null
  const areaId = `${GEOM_PREFIX.greenArea}${featureId}`
  const assetId = `${GEOM_PREFIX.greenAsset}${featureId}`
  return geometries.find((g) => g.geom_id === areaId || g.geom_id === assetId) ?? null
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
  const prefix = preferAsset ? GEOM_PREFIX.greenAsset : GEOM_PREFIX.greenArea
  return {
    type: 'WKT',
    data: wkt,
    geom_id: `${prefix}${feature.id}`,
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
  const mounted = findMountedGreenClip(host, feature.id)
  const redClip = mounted
    ? withRedSelection(mounted)
    : fallbackClipFromFeature(feature, preferAsset)
  if (!redClip) return null

  // Keep the first-captured green clip across reassert/re-set (cache is already red).
  const restore =
    host.detailHighlightRestoreClip?.geom_id === redClip.geom_id
      ? host.detailHighlightRestoreClip
      : mounted
        ? { ...mounted }
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
  // Always clear previous selection before applying the new one.
  if (host.detailHighlightFeature && host.detailHighlightFeature.id !== feature.id) {
    restoreSelectionColor(host)
  }

  applySelectionRecolor(host, feature, preferAsset)
}
