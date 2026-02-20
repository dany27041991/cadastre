/**
 * Green assets layer: cluster config and distance-by-zoom logic.
 * Used by useTerritoryMap for the green (asset points) layer.
 */
export const GREEN_CLUSTER_MAX_ZOOM_THRESHOLD = 17
export const GREEN_CLUSTER_ZOOM_DETAIL = 16
export const GREEN_CLUSTER_ZOOM_OVERVIEW = 10
export const GREEN_CLUSTER_DISTANCE_AT_16 = 48
export const GREEN_CLUSTER_DISTANCE_AT_10 = 170
export const GREEN_CLUSTER_ZOOM_THROTTLE_MS = 280
export const GREEN_CLUSTER_IDLE_TIMEOUT_MS = 150
export const GREEN_CORE_RADIUS = 5

export interface GreenClusterConfig {
  getDistanceForZoom: (zoom: number) => number
}

function getClusterDistanceForZoom(zoom: number): number {
  const z = Math.floor(zoom)
  if (z >= GREEN_CLUSTER_MAX_ZOOM_THRESHOLD) return 0
  if (z >= GREEN_CLUSTER_ZOOM_DETAIL) return GREEN_CLUSTER_DISTANCE_AT_16
  const t =
    (GREEN_CLUSTER_ZOOM_DETAIL - z) /
    (GREEN_CLUSTER_ZOOM_DETAIL - GREEN_CLUSTER_ZOOM_OVERVIEW)
  const tClamped = Math.max(0, Math.min(1, t))
  return Math.round(
    GREEN_CLUSTER_DISTANCE_AT_16 +
      tClamped * (GREEN_CLUSTER_DISTANCE_AT_10 - GREEN_CLUSTER_DISTANCE_AT_16)
  )
}

export const greenClusterConfig: GreenClusterConfig = {
  getDistanceForZoom: getClusterDistanceForZoom,
}
