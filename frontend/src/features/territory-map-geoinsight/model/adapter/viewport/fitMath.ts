import { readMapViewportPx } from '../../../lib/mapViewportBbox'
import { WEB_MERCATOR_RESOLUTION_BASE } from './constants'

/** Zoom needed so the bbox fits the viewport (WGS84 degrees -> web mercator resolution). */
export function fitZoomForBbox(bbox: [number, number, number, number]): number {
  const [minLon, minLat, maxLon, maxLat] = bbox
  const midLat = (minLat + maxLat) / 2
  const cosLat = Math.max(0.2, Math.cos((midLat * Math.PI) / 180))
  const widthM = Math.max(1, (maxLon - minLon) * 111_320 * cosLat)
  const heightM = Math.max(1, (maxLat - minLat) * 111_320)
  const { width, height } = readMapViewportPx()
  const resolution = Math.max(widthM / width, heightM / height)
  return Math.log2((WEB_MERCATOR_RESOLUTION_BASE * cosLat) / resolution)
}
