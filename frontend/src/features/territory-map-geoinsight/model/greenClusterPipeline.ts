/**
 * Green asset cluster display → Geoinsight geometries (phase 3).
 */
import type { GeoJSONFeatureCollection } from '@/shared/types'
import type { GeoinsightGeometryClip } from '@/features/territory/lib/geoJsonToGeoinsight'
import {
  geoJsonToClusterInputs,
  GREEN_CLUSTER_ZOOM_DETAIL,
  type ClusterDisplayItem,
  type ClusterInputFeature,
} from '@/features/territory/lib/greenAssetClusterCore'
import {
  buildGreenAssetGeometryClip,
  buildClusterCountLabelClip,
  prepareAssetGeometryForDisplay,
  shouldShowClusterCountLabels,
} from '../lib/greenAssetMapStyle'
import { clusterLabelGeomId } from '../lib/clusterCircleGeometry'
import { geometryToWkt } from '../lib/geometryToWkt'
import { GEOM_PREFIX } from './constants'
import type { GeometryRegistryEntry } from './geometryRegistry'

export interface GreenClusterLayerPayload {
  geometries: GeoinsightGeometryClip[]
  registryEntries: GeometryRegistryEntry[]
  showClusterCountLabels: boolean
}

function displayItemToGeomId(
  item: ClusterDisplayItem,
  zoomLevel: number,
  index: number
): string {
  if (item.isCluster) {
    // Grid-cell key + count keep ids stable across pans (diff mount skips unchanged
    // clusters) while edge cells whose membership changed get remounted.
    const suffix =
      item.clusterKey != null ? `${item.clusterKey}_${item.memberCount}` : String(index)
    return `${GEOM_PREFIX.cluster}${zoomLevel}_${suffix}`
  }
  return `${GEOM_PREFIX.greenAsset}${item.id}`
}

/**
 * Single-asset WKT keyed by the stable raw input geometry object. Pan refreshes
 * rebuilt WKT (and line dashing) for every viewport asset on each refresh even
 * though the diff then mounted only a few dozen new ones (debug logs: pan-viewport
 * buildMs avg 27.6ms, max 136ms). Singles do not depend on zoom, so cache them.
 */
const singleAssetWktCache = new WeakMap<object, string>()

function wktForDisplayItem(item: ClusterDisplayItem, mapZoom: number): string | null {
  if (item.isCluster) {
    return geometryToWkt(prepareAssetGeometryForDisplay(item, mapZoom))
  }
  const key = item.geometry as object
  const cached = singleAssetWktCache.get(key)
  if (cached != null) return cached
  const wkt = geometryToWkt(prepareAssetGeometryForDisplay(item, mapZoom))
  if (wkt) singleAssetWktCache.set(key, wkt)
  return wkt
}

export function buildGreenClusterLayerPayload(
  displayItems: ClusterDisplayItem[],
  zoomLevel: number,
  mapZoom = zoomLevel
): GreenClusterLayerPayload {
  const showClusterCountLabels = shouldShowClusterCountLabels(displayItems)
  const geometries: GeoinsightGeometryClip[] = []
  const registryEntries: GeometryRegistryEntry[] = []

  displayItems.forEach((item, index) => {
    const wkt = wktForDisplayItem(item, mapZoom)
    if (!wkt) return
    const geomId = displayItemToGeomId(item, zoomLevel, index)
    geometries.push(buildGreenAssetGeometryClip(geomId, wkt, item))
    if (showClusterCountLabels && item.isCluster && (item.memberCount ?? 0) >= 1) {
      const labelWkt = geometryToWkt(item.geometry)
      if (labelWkt) {
        geometries.push(
          buildClusterCountLabelClip(clusterLabelGeomId(item.memberCount, geomId), labelWkt)
        )
      }
    }
    registryEntries.push({
      id: item.isCluster ? index : item.id,
      label: item.label,
      geomId,
      layerKind: item.isCluster ? 'cluster' : 'green_asset',
      bbox: item.bbox,
      properties: item.properties,
      geometry: item.geometry,
      isCluster: item.isCluster,
      memberCount: item.memberCount,
      members: item.members,
    })
  })

  return { geometries, registryEntries, showClusterCountLabels }
}

/**
 * Converts a server viewport response (raw assets or lakehouse gold clusters from
 * GET /green-assets/viewport) into display items for the standard mount pipeline.
 * Cluster features carry cluster_count / cluster_key / cluster_bbox properties.
 */
export function serverViewportCollectionToDisplayItems(
  collection: GeoJSONFeatureCollection
): ClusterDisplayItem[] {
  const clusterItems: ClusterDisplayItem[] = []
  const rawFeatures: GeoJSONFeatureCollection['features'] = []
  for (const feature of collection.features ?? []) {
    if (!feature?.geometry) continue
    const props = (feature.properties ?? {}) as Record<string, unknown>
    if (props.cluster !== true) {
      rawFeatures.push(feature)
      continue
    }
    const memberCount = Number(props.cluster_count) || 1
    const bbox =
      Array.isArray(props.cluster_bbox) && props.cluster_bbox.length === 4
        ? (props.cluster_bbox.map(Number) as [number, number, number, number])
        : null
    // TODO: single-member server cells still render as 1-count clusters; the
    // viewport endpoint only returns the cell centroid, not the raw geometry.
    clusterItems.push({
      id: -(clusterItems.length + 1),
      label: String(memberCount),
      properties: { cluster_count: memberCount },
      geometry: feature.geometry,
      isCluster: true,
      memberCount,
      members: [],
      bbox,
      clusterKey: typeof props.cluster_key === 'string' ? props.cluster_key : undefined,
    })
  }
  const singles = clusterInputsToDisplayItems(
    geoJsonToClusterInputs({ type: 'FeatureCollection', features: rawFeatures })
  )
  return [...clusterItems, ...singles]
}

export function clusterInputsToDisplayItems(
  inputs: ClusterInputFeature[]
): ClusterDisplayItem[] {
  return inputs.map((f) => ({
    id: f.id,
    label: f.label,
    properties: f.properties,
    geometry: f.geometry,
    isCluster: false,
    memberCount: 1,
    members: [f],
    // Propagate cached centroid bbox from geoJsonToClusterInputs — needed for
    // registry hit helpers / extent; null previously dropped single assets.
    bbox: f.bbox ?? null,
  }))
}

export function viewportClusterZoom(mapZoom: number): number {
  return Math.min(Math.floor(mapZoom), GREEN_CLUSTER_ZOOM_DETAIL)
}
