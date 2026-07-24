/**
 * Vendor map reaches ~19.17 (observed max discrete level). Clamping at 17 blocked
 * the final cluster drill step: zoomToPoint snaps to discrete levels (…16.85, 17.85,
 * 19.17), so a 17.00 target snapped back to 16.85 and the zoom never moved.
 */
export const VIEW_MAX_ZOOM = 19.2
export const ZOOM_FIT_PADDING_RATIO = 0.05
export const MIN_BBOX_PAD_DEGREES = 0.005
/** Extra zoom-out when framing a municipality (province→comune, sub→comune). */
export const MUNICIPALITY_FRAME_ZOOM_OFFSET = -1.5

/**
 * Server aggregation thresholds (mirror backend viewport_grid.py):
 * region <7, province <9, municipality <13, grid <19, raw ≥19.
 * Cluster click must land past the next threshold or the viewport refetch
 * returns the same aggregation level (clusters appear "not exploded").
 */
export const CLUSTER_DRILL_ZOOM_THRESHOLDS = [7, 9, 13, 19] as const

/** Next zoom that changes cluster aggregation; nudge past threshold for vendor snap. */
export function nextClusterDrillZoom(currentZoom: number): number {
  for (const threshold of CLUSTER_DRILL_ZOOM_THRESHOLDS) {
    if (currentZoom < threshold) {
      return Math.min(VIEW_MAX_ZOOM, threshold + 0.15)
    }
  }
  return Math.min(VIEW_MAX_ZOOM, currentZoom + 1.5)
}

export { webMercatorScaleForZoom } from '../lib/webMercatorConstants'

export function isValidBbox(
  bbox: [number, number, number, number] | null | undefined
): bbox is [number, number, number, number] {
  return bbox != null && bbox.length === 4 && bbox.every((v) => Number.isFinite(v))
}

/** OpenLayers buffer(extent, getWidth(extent) * 0.05) equivalent in WGS84 degrees. */
export function bufferBbox(
  bbox: [number, number, number, number],
  ratio = ZOOM_FIT_PADDING_RATIO
): [number, number, number, number] {
  const [minX, minY, maxX, maxY] = bbox
  const padX = Math.max((maxX - minX) * ratio, MIN_BBOX_PAD_DEGREES)
  const padY = Math.max((maxY - minY) * ratio, MIN_BBOX_PAD_DEGREES)
  return [minX - padX, minY - padY, maxX + padX, maxY + padY]
}

export function bboxCenter(
  bbox: [number, number, number, number]
): [number, number] {
  return [(bbox[0] + bbox[2]) / 2, (bbox[1] + bbox[3]) / 2]
}
