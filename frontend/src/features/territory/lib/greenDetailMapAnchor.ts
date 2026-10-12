/**
 * Screen ↔ geographic anchoring for the green detail FloatingPanel.
 * Keeps the panel glued to the clicked map point across pan/zoom.
 */
import { fromLonLat, toLonLat } from 'ol/proj'
import { geoinsightConfig } from '@/app/config/geoinsight'
import { useGeoinsightStore } from '@/app/store/useGeoinsightStore'
import { getResolutionForZoomWebMercator } from '@/features/territory/lib/greenAssetClusterCore'
import type { TerritoryMapFeature } from '@/features/territory/types/mapFeature'
import { parseZoomFromCenterScale } from '@/features/territory-map-geoinsight/model/parseMapZoom'
import { MAP_TRIGGER } from '@/features/territory-map-geoinsight/model/adapter/simple-draw/constants'
import { getMapWidgetProxy } from '@/features/territory-map-geoinsight/model/adapter/simple-draw/mapWidgetHost'

const WEB_MERCATOR_HALF = 20_037_508.34
const METERS_PER_DEGREE = 111_320

export type ScreenPoint = { clientX: number; clientY: number }

/** Minimal OpenLayers map surface used for live pan/zoom projection. */
export type LiveOlMap = {
  getPixelFromCoordinate?: (coordinate: number[]) => number[] | null | undefined
  getCoordinateFromPixel?: (pixel: number[]) => number[] | null | undefined
  getTargetElement?: () => HTMLElement | null | undefined
  on?: (type: string, listener: (event?: unknown) => void) => void
  un?: (type: string, listener: (event?: unknown) => void) => void
}

function asLiveOlMap(wrapper: unknown): LiveOlMap | null {
  if (wrapper == null || typeof wrapper !== 'object') return null
  const rec = wrapper as LiveOlMap & { instance?: unknown }
  if (typeof rec.getPixelFromCoordinate === 'function') return rec
  const inst = rec.instance
  if (inst && typeof inst === 'object' && typeof (inst as LiveOlMap).getPixelFromCoordinate === 'function') {
    return inst as LiveOlMap
  }
  return null
}

/** Live OpenLayers map (updates during DragPan); null when Geoinsight is unavailable. */
export function getLiveOlMap(): LiveOlMap | null {
  try {
    const raw = getMapWidgetProxy()?.$trigger?.(MAP_TRIGGER.getMapInstance, [
      geoinsightConfig.mapId,
    ])
    return asLiveOlMap(raw)
  } catch {
    return null
  }
}

function lonLatToClientPointFromOl(lon: number, lat: number): ScreenPoint | null {
  const map = getLiveOlMap()
  if (!map?.getPixelFromCoordinate || !map.getTargetElement) return null
  const pixel = map.getPixelFromCoordinate(fromLonLat([lon, lat]))
  const el = map.getTargetElement()
  if (!pixel || pixel.length < 2 || !el) return null
  if (!Number.isFinite(pixel[0]) || !Number.isFinite(pixel[1])) return null
  const rect = el.getBoundingClientRect()
  return {
    clientX: Math.round(rect.left + pixel[0]),
    clientY: Math.round(rect.top + pixel[1]),
  }
}

function clientPointToLonLatFromOl(
  clientX: number,
  clientY: number,
): [number, number] | null {
  const map = getLiveOlMap()
  if (!map?.getCoordinateFromPixel || !map.getTargetElement) return null
  const el = map.getTargetElement()
  if (!el) return null
  const rect = el.getBoundingClientRect()
  const coordinate = map.getCoordinateFromPixel([
    clientX - rect.left,
    clientY - rect.top,
  ])
  if (!coordinate || coordinate.length < 2) return null
  const [lon, lat] = toLonLat(coordinate)
  if (!Number.isFinite(lon) || !Number.isFinite(lat)) return null
  return [lon, lat]
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

/** Polygon (or Point when degenerate) from a WGS84 bbox — used for table→detail framing. */
export function polygonGeometryFromBbox(
  bbox: [number, number, number, number]
): object {
  const [minLon, minLat, maxLon, maxLat] = bbox
  if (minLon === maxLon && minLat === maxLat) {
    return { type: 'Point', coordinates: [minLon, minLat] }
  }
  return {
    type: 'Polygon',
    coordinates: [
      [
        [minLon, minLat],
        [maxLon, minLat],
        [maxLon, maxLat],
        [minLon, maxLat],
        [minLon, minLat],
      ],
    ],
  }
}

/** WGS84 bbox of a map feature geometry, or null when empty / unknown. */
export function bboxFromMapFeature(
  feature: TerritoryMapFeature
): [number, number, number, number] | null {
  return bboxFromGeometry(feature.geometry)
}

/** Geographic center of a map feature (point or bbox midpoint). */
export function lonLatFromMapFeature(
  feature: TerritoryMapFeature
): [number, number] | null {
  const geom = feature.geometry as { type?: string; coordinates?: unknown }
  if (geom?.type === 'Point' && Array.isArray(geom.coordinates)) {
    const lon = Number(geom.coordinates[0])
    const lat = Number(geom.coordinates[1])
    if (Number.isFinite(lon) && Number.isFinite(lat)) return [lon, lat]
  }
  const bbox = bboxFromMapFeature(feature)
  if (!bbox) return null
  return [(bbox[0] + bbox[2]) / 2, (bbox[1] + bbox[3]) / 2]
}

function isWebMercatorEpsg(epsg: string | undefined): boolean {
  if (!epsg) return false
  const normalized = epsg.toUpperCase().replace('EPSG:', '')
  return normalized === '3857' || normalized === '900913'
}

function mercatorToLonLat(x: number, y: number): [number, number] {
  const lon = (x * 180) / WEB_MERCATOR_HALF
  const lat =
    (180 / Math.PI) * (2 * Math.atan(Math.exp((y * Math.PI) / WEB_MERCATOR_HALF)) - Math.PI / 2)
  return [lon, lat]
}

function centerToWgs84(center: number[], epsg: string | undefined): [number, number] | null {
  const x = center[0]
  const y = center[1]
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null
  if (isWebMercatorEpsg(epsg)) return mercatorToLonLat(x, y)
  return [x, y]
}

function getMapViewportEl(): Element | null {
  if (typeof document === 'undefined') return null
  return (
    document.querySelector('.ol-viewport') ??
    document.querySelector('[aria-label="Map view"]')
  )
}

type MapViewSnapshot = {
  lon0: number
  lat0: number
  zoom: number
  rect: DOMRect
}

function readMapViewSnapshot(): MapViewSnapshot | null {
  const ref = useGeoinsightStore.getState().geoinsightRef?.current
  if (!ref?.getCenterAndScale) return null
  const status = ref.getCenterAndScale(geoinsightConfig.mapId) as
    | { center?: number[]; epsg?: string }
    | undefined
  const center = status?.center
  if (!center || center.length < 2) return null
  const zoom = parseZoomFromCenterScale(status)
  if (zoom == null) return null
  const wgs84 = centerToWgs84(center, status?.epsg)
  if (!wgs84) return null
  const el = getMapViewportEl()
  if (!el) return null
  const rect = el.getBoundingClientRect()
  if (rect.width <= 0 || rect.height <= 0) return null
  return { lon0: wgs84[0], lat0: wgs84[1], zoom, rect }
}

/** Project WGS84 lon/lat to viewport client coordinates. */
export function lonLatToClientPoint(lon: number, lat: number): ScreenPoint | null {
  // Prefer live OL view — getCenterAndScale stays stale during DragPan.
  const live = lonLatToClientPointFromOl(lon, lat)
  if (live) return live

  const snap = readMapViewSnapshot()
  if (!snap) return null
  const resolution = getResolutionForZoomWebMercator(snap.zoom, snap.lat0)
  const cosLat = Math.max(0.2, Math.cos((snap.lat0 * Math.PI) / 180))
  const dxPx = ((lon - snap.lon0) * METERS_PER_DEGREE * cosLat) / resolution
  const dyPx = -((lat - snap.lat0) * METERS_PER_DEGREE) / resolution
  return {
    clientX: Math.round(snap.rect.left + snap.rect.width / 2 + dxPx),
    clientY: Math.round(snap.rect.top + snap.rect.height / 2 + dyPx),
  }
}

/** Inverse: client pixel → WGS84 lon/lat at the current view. */
export function clientPointToLonLat(
  clientX: number,
  clientY: number
): [number, number] | null {
  const live = clientPointToLonLatFromOl(clientX, clientY)
  if (live) return live

  const snap = readMapViewSnapshot()
  if (!snap) return null
  const resolution = getResolutionForZoomWebMercator(snap.zoom, snap.lat0)
  const cosLat = Math.max(0.2, Math.cos((snap.lat0 * Math.PI) / 180))
  const dxPx = clientX - (snap.rect.left + snap.rect.width / 2)
  const dyPx = clientY - (snap.rect.top + snap.rect.height / 2)
  const lon = snap.lon0 + (dxPx * resolution) / (METERS_PER_DEGREE * cosLat)
  const lat = snap.lat0 - (dyPx * resolution) / METERS_PER_DEGREE
  if (!Number.isFinite(lon) || !Number.isFinite(lat)) return null
  return [lon, lat]
}

/**
 * Anchor lon/lat for a selection: prefer the click pixel when it falls on the
 * feature, otherwise the feature centroid.
 *
 * Callers must not pass a pure screen-placement hint (e.g. map 50%/20% framing)
 * as `pointer` — that used to be inverted to lon/lat and glued the panel to the
 * wrong place when switching detail without close.
 */
export function resolveGreenDetailAnchorLonLat(
  feature: TerritoryMapFeature,
  pointer?: ScreenPoint | null
): { lon: number; lat: number; screen: ScreenPoint } | null {
  const center = lonLatFromMapFeature(feature)
  const bbox = bboxFromMapFeature(feature)
  let path: 'click_on_feature' | 'click_off_use_center' | 'center_only' | 'null' = 'null'

  if (pointer) {
    const fromClick = clientPointToLonLat(pointer.clientX, pointer.clientY)
    if (fromClick) {
      const [lon, lat] = fromClick
      const onFeature =
        bbox == null
          ? center == null
          : lonIsInsideFeatureBbox(lon, lat, bbox)
      if (onFeature || center == null) {
        path = 'click_on_feature'
        return {
          lon,
          lat,
          screen: { clientX: pointer.clientX, clientY: pointer.clientY },
        }
      }
      path = 'click_off_use_center'
    }
  }

  if (!center) {
    return null
  }
  const screen =
    lonLatToClientPoint(center[0], center[1]) ??
    pointer ?? {
      clientX: Math.round(window.innerWidth / 2),
      clientY: Math.round(window.innerHeight * 0.35),
    }
  if (path === 'null') path = 'center_only'
  return { lon: center[0], lat: center[1], screen }
}

/** Loose pad so edge clicks on large polygons still count as on-feature. */
function lonIsInsideFeatureBbox(
  lon: number,
  lat: number,
  bbox: [number, number, number, number]
): boolean {
  const padLon = Math.max(0.0005, (bbox[2] - bbox[0]) * 0.05)
  const padLat = Math.max(0.0005, (bbox[3] - bbox[1]) * 0.05)
  return (
    lon >= bbox[0] - padLon &&
    lon <= bbox[2] + padLon &&
    lat >= bbox[1] - padLat &&
    lat <= bbox[3] + padLat
  )
}
