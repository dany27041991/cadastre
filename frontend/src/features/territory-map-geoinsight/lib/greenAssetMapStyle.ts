import type { ClusterDisplayItem } from '@/features/territory/lib/greenAssetClusterCore'
import type { GeoinsightGeometryClip } from '@/features/territory/lib/geoJsonToGeoinsight'
import { GEOINSIGHT_EPSG_WGS84 } from '../model/constants'
import { clusterItemToCirclePolygon } from './clusterCircleGeometry'
import { dashLinearGeometry } from './dashLineGeometry'

export type GeoinsightColor = string

export type GreenAssetVisualKind = 'cluster' | 'point' | 'line' | 'surface'

/** Green asset points/surfaces share the same fill opacity in the Geoinsight patch. */
export const GREEN_ASSET_FILL_ALPHA = 0.42

/** Green asset points (trees/shrubs). */
export const GREEN_ASSET_POINT_COLOR = '#15803d'
export const GREEN_ASSET_LINE_COLOR = '#1a5f2a'
/** Darker than managed green areas (#16a34a); Geoinsight derives fill alpha from hex. */
export const GREEN_ASSET_SURFACE_FILL = '#0f7637'

/** Azure cluster fill — hex required by Geoinsight temp geometry styling. */
export const GREEN_CLUSTER_FILL = '#38bdf8'
export const GREEN_CLUSTER_LABEL_COLOR = '#ffffff'
export const GREEN_CLUSTER_LABEL_BORDER = '#0284c7'

const TREE_POINT_SIZE_PX = 6
const LINE_STROKE_WIDTH = 2.5

const HIDDEN_LABEL_FIELDS = {
  label: '',
  geom_label: '',
  show_label: false,
  label_visibility: false,
  hide_label: true,
} as const

export function classifyGreenAssetDisplay(item: ClusterDisplayItem): GreenAssetVisualKind {
  if (item.isCluster) return 'cluster'

  const geometryType = item.properties?.geometry_type
  if (geometryType === 'P' || geometryType === 'p') return 'point'
  if (geometryType === 'L' || geometryType === 'l') return 'line'
  if (geometryType === 'S' || geometryType === 's') return 'surface'

  const geomType = (item.geometry as { type?: string }).type
  if (geomType === 'Point' || geomType === 'MultiPoint') return 'point'
  if (geomType === 'LineString' || geomType === 'MultiLineString') return 'line'
  if (geomType === 'Polygon' || geomType === 'MultiPolygon') return 'surface'

  return 'point'
}

export function prepareAssetGeometryForDisplay(
  item: ClusterDisplayItem,
  mapZoom = 10
): object {
  if (item.isCluster) return clusterItemToCirclePolygon(item, mapZoom)
  if (classifyGreenAssetDisplay(item) !== 'line') return item.geometry
  return dashLinearGeometry(item.geometry)
}

export function buildGreenAssetGeometryClip(
  geomId: string,
  wkt: string,
  item: ClusterDisplayItem
): GeoinsightGeometryClip {
  const kind = classifyGreenAssetDisplay(item)
  const base: GeoinsightGeometryClip = {
    type: 'WKT',
    data: wkt,
    geom_id: geomId,
    epsg: GEOINSIGHT_EPSG_WGS84,
    ...HIDDEN_LABEL_FIELDS,
  }

  switch (kind) {
    case 'cluster':
      return {
        ...base,
        color: GREEN_CLUSTER_FILL,
      }
    case 'point':
      return {
        ...base,
        color: GREEN_ASSET_POINT_COLOR,
        width: TREE_POINT_SIZE_PX,
        stroke_width: TREE_POINT_SIZE_PX,
      }
    case 'line':
      return {
        ...base,
        color: GREEN_ASSET_LINE_COLOR,
        stroke_width: LINE_STROKE_WIDTH,
        width: LINE_STROKE_WIDTH,
      }
    case 'surface':
      return {
        ...base,
        color: GREEN_ASSET_SURFACE_FILL,
        stroke_width: 1.5,
        width: 1.5,
      }
    default:
      return { ...base, color: GREEN_ASSET_POINT_COLOR }
  }
}

/** True when the payload includes clusters (enables count label helpers). */
export function shouldShowClusterCountLabels(items: ClusterDisplayItem[]): boolean {
  return items.some((item) => item.isCluster && (item.memberCount ?? 0) >= 1)
}

/** Invisible point used only to render the member count when label visibility is on. */
export function buildClusterCountLabelClip(geomId: string, wkt: string): GeoinsightGeometryClip {
  return {
    type: 'WKT',
    data: wkt,
    geom_id: geomId,
    epsg: GEOINSIGHT_EPSG_WGS84,
    color: GREEN_CLUSTER_FILL,
    label_color: GREEN_CLUSTER_LABEL_COLOR,
    label_border_color: GREEN_CLUSTER_LABEL_BORDER,
    ...HIDDEN_LABEL_FIELDS,
  }
}
