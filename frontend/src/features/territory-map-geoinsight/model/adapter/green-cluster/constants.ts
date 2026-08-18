import type { GeoJSONFeatureCollection } from '@/shared/types'

/**
 * Below this zoom the areas layer is not rendered (admin/grid clusters cover
 * those bands); mirrors VIEWPORT_AREAS_MIN_ZOOM on the backend.
 */
export const GREEN_AREAS_VIEWPORT_MIN_ZOOM = 12

/** Absorbs vendor fractional zoom jitter during animations. */
export const GREEN_ZOOM_JITTER_EPSILON = 0.35

export const EMPTY_FEATURE_COLLECTION: GeoJSONFeatureCollection = {
  type: 'FeatureCollection',
  features: [],
}

// Pan refreshes are diff-mounted and chunked (cheap); the upstream pan debounce
// already coalesces movement, so this stage only needs to absorb bursts.
export const RAW_CLUSTER_APPLY_DEBOUNCE_MS = 40
/**
 * Zoom steps are detected by the 120ms poll, so an 80ms debounce fired on every
 * intermediate discrete level during continuous zoom. 200ms > poll interval
 * coalesces the steps; only the settle level is mounted.
 */
export const RAW_ZOOM_APPLY_DEBOUNCE_MS = 200

/**
 * Viewport refreshes are deferred while a map drag is in progress and coalesced
 * into a single cycle on pointer release (avoids mid-gesture GC freezes).
 */
export const APPLY_REASON = {
  rawZoomChange: 'raw-zoom-change',
  panViewport: 'pan-viewport',
} as const

export type ApplyReason = (typeof APPLY_REASON)[keyof typeof APPLY_REASON]

export const LAYER_KIND = {
  cluster: 'cluster',
  greenArea: 'green_area',
} as const

/** Zero-width space used in some cluster label geom ids. */
export const CLUSTER_ID_ZWSP = '\u200B'

export const CANVAS_SELECTOR = 'canvas'

// 1.5s idle pruning fired inside the user's natural pause between two drags.
// Prune only after the map has been still for a while, in small batches.
export const PAN_STALE_PRUNE_IDLE_MS = 6000
export const PAN_STALE_PRUNE_REPEAT_MS = 2000
export const PAN_STALE_PRUNE_BATCH = 200
export const PAN_STALE_PRUNE_MIN = 400
export const PAN_STALE_FORCE_DROP_MAX = 400
export const PAN_STALE_FORCE_PRUNE_AT = 800
