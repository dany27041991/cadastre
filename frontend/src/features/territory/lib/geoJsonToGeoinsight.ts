/**
 * GeoJSON FeatureCollection → Geoinsight addGeometries payload (WKT).
 */
import WKT from 'terraformer-wkt-parser'
import type { GeoJSONFeatureCollection } from '@/shared/types'
import { resolveFeatureId, resolveFeatureLabel } from './featureIdentity'
import {
  GEOINSIGHT_EPSG_WGS84,
  TERRITORY_GEOMETRY_FILL_COLOR,
} from '@/features/territory-map-geoinsight/model/constants'

export interface GeoinsightGeometryClip {
  type: 'WKT'
  data: string
  geom_id: string
  epsg: string
  /** Hex or RGBA — Geoinsight stroke/fill. */
  color?: string | [number, number, number, number]
  width?: number
  stroke_width?: number
  label?: string
  geom_label?: string
  show_label?: boolean
  label_visibility?: boolean
  hide_label?: boolean
  label_color?: string
  label_border_color?: string
}

export interface GeoinsightFeatureMeta {
  id: number
  label: string
  geomId: string
  bbox: [number, number, number, number] | null
}

export interface GeoJsonToGeoinsightResult {
  geometries: GeoinsightGeometryClip[]
  metas: GeoinsightFeatureMeta[]
}

function extendBbox(
  bbox: [number, number, number, number] | null,
  lon: number,
  lat: number
): [number, number, number, number] {
  if (bbox == null) return [lon, lat, lon, lat]
  return [
    Math.min(bbox[0], lon),
    Math.min(bbox[1], lat),
    Math.max(bbox[2], lon),
    Math.max(bbox[3], lat),
  ]
}

function walkCoordinates(
  coords: unknown,
  depth: number,
  acc: { bbox: [number, number, number, number] | null }
): void {
  if (!Array.isArray(coords)) return
  if (depth === 0) {
    const lon = Number(coords[0])
    const lat = Number(coords[1])
    if (Number.isFinite(lon) && Number.isFinite(lat)) {
      acc.bbox = extendBbox(acc.bbox, lon, lat)
    }
    return
  }
  for (const part of coords) {
    walkCoordinates(part, depth - 1, acc)
  }
}

function bboxFromGeometry(geometry: object): [number, number, number, number] | null {
  const geom = geometry as { type?: string; coordinates?: unknown }
  if (!geom.type || geom.coordinates == null) return null
  // Depth = how many nested arrays until [lon, lat].
  // Point: [lon,lat]→0; LineString/MultiPoint: [[lon,lat],…]→1;
  // Polygon/MultiLineString: [[[lon,lat],…],…]→2; MultiPolygon→3.
  const depth =
    geom.type === 'Point'
      ? 0
      : geom.type === 'LineString' || geom.type === 'MultiPoint'
        ? 1
        : geom.type === 'Polygon' || geom.type === 'MultiLineString'
          ? 2
          : geom.type === 'MultiPolygon'
            ? 3
            : -1
  if (depth < 0) return null
  const acc = { bbox: null as [number, number, number, number] | null }
  walkCoordinates(geom.coordinates, depth, acc)
  return acc.bbox
}

/**
 * Bbox of the largest polygon part (by envelope area).
 * MultiPolygon envelopes that span distant slivers center the camera on empty
 * gap (debug 4fe799: Area boost 3 parts at 7.784 vs 7.796 → fit at 7.790).
 */
export function largestComponentBbox(
  geometry: object
): [number, number, number, number] | null {
  const geom = geometry as { type?: string; coordinates?: unknown }
  if (geom.type === 'MultiPolygon' && Array.isArray(geom.coordinates)) {
    let best: [number, number, number, number] | null = null
    let bestArea = -1
    for (const poly of geom.coordinates) {
      const acc = { bbox: null as [number, number, number, number] | null }
      walkCoordinates(poly, 2, acc)
      if (acc.bbox == null) continue
      const [minLon, minLat, maxLon, maxLat] = acc.bbox
      const area = Math.max(0, maxLon - minLon) * Math.max(0, maxLat - minLat)
      if (area > bestArea) {
        bestArea = area
        best = acc.bbox
      }
    }
    return best ?? bboxFromGeometry(geometry)
  }
  return bboxFromGeometry(geometry)
}

function geometryToWkt(geometry: object): string | null {
  try {
    const wkt = WKT.convert(geometry as Parameters<typeof WKT.convert>[0])
    return typeof wkt === 'string' && wkt.length > 0 ? wkt : null
  } catch {
    return null
  }
}

export interface GeoJsonToGeoinsightOptions {
  color?: string | [number, number, number, number]
  epsg?: string
  /**
   * Build a stable vendor geom_id. Default `${prefix}${numericId}`.
   * Green areas must include municipality_id — area ids collide across comuni
   * (e.g. 31× id=1 in one national viewport, Garibaldi lost under GA_1).
   */
  geomIdForFeature?: (
    properties: Record<string, unknown>,
    id: number,
    prefix: string
  ) => string
}

export function geoJsonToGeoinsightGeometries(
  collection: GeoJSONFeatureCollection,
  geomIdPrefix: string,
  options?: GeoJsonToGeoinsightOptions
): GeoJsonToGeoinsightResult {
  const epsg = options?.epsg ?? GEOINSIGHT_EPSG_WGS84
  const color = options?.color ?? TERRITORY_GEOMETRY_FILL_COLOR
  const geometries: GeoinsightGeometryClip[] = []
  const metas: GeoinsightFeatureMeta[] = []
  const seenGeomIds = new Set<string>()

  for (const feature of collection.features ?? []) {
    if (!feature?.geometry) continue
    const wkt = geometryToWkt(feature.geometry)
    if (!wkt) continue
    const properties = (feature.properties ?? {}) as Record<string, unknown>
    const id = resolveFeatureId(properties, feature.id)
    if (!Number.isFinite(id)) continue
    const geomId = options?.geomIdForFeature
      ? options.geomIdForFeature(properties, id, geomIdPrefix)
      : `${geomIdPrefix}${id}`
    // Skip collisions so the first (or caller-ordered) feature wins only when
    // ids are still non-unique; with municipality-scoped ids this is a no-op.
    if (seenGeomIds.has(geomId)) continue
    seenGeomIds.add(geomId)
    const label = resolveFeatureLabel(properties, id)
    geometries.push({
      type: 'WKT',
      data: wkt,
      geom_id: geomId,
      epsg,
      color,
      label: '',
      geom_label: '',
      show_label: false,
      label_visibility: false,
      hide_label: true,
    })
    metas.push({
      id,
      label,
      geomId,
      bbox: bboxFromGeometry(feature.geometry),
    })
  }

  return { geometries, metas }
}

export function unionBboxes(
  boxes: Array<[number, number, number, number] | null>
): [number, number, number, number] | null {
  let result: [number, number, number, number] | null = null
  for (const box of boxes) {
    if (!box) continue
    if (result == null) {
      result = [...box]
      continue
    }
    result = [
      Math.min(result[0], box[0]),
      Math.min(result[1], box[1]),
      Math.max(result[2], box[2]),
      Math.max(result[3], box[3]),
    ]
  }
  return result
}
