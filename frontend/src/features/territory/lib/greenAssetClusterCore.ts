/**
 * Engine-agnostic green asset display primitives (EPSG:4326 input).
 * Clustering happens server-side (viewport endpoint); the client only converts
 * GeoJSON features into display inputs with cached centroid/bbox.
 */
import type { GeoJSONFeatureCollection } from '@/shared/types'
import { resolveFeatureId, resolveFeatureLabel } from './featureIdentity'

export const GREEN_CLUSTER_ZOOM_DETAIL = 16
export const GREEN_CLUSTER_ZOOM_OVERVIEW = 10

export interface ClusterInputFeature {
  id: number
  label: string
  properties: Record<string, unknown>
  geometry: object
  /** Cached centroid + bbox (computed once at load; geometry scans are expensive at 88k inputs). */
  lon?: number
  lat?: number
  bbox?: [number, number, number, number] | null
}

export interface ClusterDisplayItem {
  id: number
  label: string
  properties: Record<string, unknown>
  geometry: object
  isCluster: boolean
  memberCount: number
  members: ClusterInputFeature[]
  bbox: [number, number, number, number] | null
  /** Stable grid-cell key — keeps cluster geom_ids identical across pans (diff mount). */
  clusterKey?: string
}

/** Web Mercator resolution (m/px) at latitude for OSM-style zoom level. */
export function getResolutionForZoomWebMercator(zoom: number, latitude = 41.9): number {
  const scale = 156543.03392804097 * Math.cos((latitude * Math.PI) / 180)
  return scale / 2 ** zoom
}

function bboxFromLonLat(lon: number, lat: number): [number, number, number, number] {
  return [lon, lat, lon, lat]
}

function extendBbox(
  bbox: [number, number, number, number] | null,
  lon: number,
  lat: number
): [number, number, number, number] {
  if (bbox == null) return bboxFromLonLat(lon, lat)
  return [
    Math.min(bbox[0], lon),
    Math.min(bbox[1], lat),
    Math.max(bbox[2], lon),
    Math.max(bbox[3], lat),
  ]
}

function walkLonLat(
  coords: unknown,
  depth: number,
  acc: { lon?: number; lat?: number; bbox: [number, number, number, number] | null }
): void {
  if (!Array.isArray(coords)) return
  if (depth === 0) {
    const lon = Number(coords[0])
    const lat = Number(coords[1])
    if (!Number.isFinite(lon) || !Number.isFinite(lat)) return
    acc.lon = lon
    acc.lat = lat
    acc.bbox = extendBbox(acc.bbox, lon, lat)
    return
  }
  for (const part of coords) walkLonLat(part, depth - 1, acc)
}

function geometryCoordDepth(type: string): number {
  switch (type) {
    case 'Point':
      return 0
    case 'LineString':
    case 'MultiPoint':
      return 1
    case 'Polygon':
    case 'MultiLineString':
      return 2
    case 'MultiPolygon':
      return 3
    default:
      return -1
  }
}

function geometryLonLat(geometry: object): { lon: number; lat: number; bbox: [number, number, number, number] | null } | null {
  const geom = geometry as { type?: string; coordinates?: unknown }
  if (!geom.type || geom.coordinates == null) return null
  const depth = geometryCoordDepth(geom.type)
  if (depth < 0) return null
  const acc = { bbox: null as [number, number, number, number] | null, lon: undefined as number | undefined, lat: undefined as number | undefined }
  walkLonLat(geom.coordinates, depth, acc)
  if (acc.lon == null || acc.lat == null) {
    if (acc.bbox) {
      return {
        lon: (acc.bbox[0] + acc.bbox[2]) / 2,
        lat: (acc.bbox[1] + acc.bbox[3]) / 2,
        bbox: acc.bbox,
      }
    }
    return null
  }
  return { lon: acc.lon, lat: acc.lat, bbox: acc.bbox ?? bboxFromLonLat(acc.lon, acc.lat) }
}

/** Cached position for an input feature; computes and memoizes on first access. */
function inputPosition(
  feature: ClusterInputFeature
): { lon: number; lat: number; bbox: [number, number, number, number] | null } | null {
  if (feature.lon != null && feature.lat != null) {
    return { lon: feature.lon, lat: feature.lat, bbox: feature.bbox ?? null }
  }
  const pos = geometryLonLat(feature.geometry)
  if (!pos) return null
  feature.lon = pos.lon
  feature.lat = pos.lat
  feature.bbox = pos.bbox
  return pos
}

export function geoJsonToClusterInputs(
  collection: GeoJSONFeatureCollection
): ClusterInputFeature[] {
  const inputs: ClusterInputFeature[] = []
  for (const feature of collection.features ?? []) {
    if (!feature?.geometry) continue
    const id = resolveFeatureId(feature.properties ?? {}, feature.id)
    if (!Number.isFinite(id)) continue
    const input: ClusterInputFeature = {
      id,
      label: resolveFeatureLabel(feature.properties ?? {}, id),
      properties: feature.properties ?? {},
      geometry: feature.geometry,
    }
    inputPosition(input)
    inputs.push(input)
  }
  return inputs
}
