/** Green detail framing: feature at horizontal center, 20% from top. */
export const GREEN_DETAIL_FRAME_FRACTION_X = 0.5
export const GREEN_DETAIL_FRAME_FRACTION_Y = 0.2

export const METERS_PER_DEGREE = 111_320
export const ZOOM_CLAMP_DELAY_MS = 420
export const WEB_MERCATOR_RESOLUTION_BASE = 156543.03392804097
// Vendor snaps zoomToPoint to discrete levels (~1.0-1.3 apart: …16.85, 17.85, 19.17).
// A +1 step from 16.85 targeted 17.00 which snapped back to 16.85 (runtime evidence),
// stalling the drill; +1.5 guarantees landing on the next discrete level.
export const DRILL_MIN_ZOOM_STEP = 1.5
