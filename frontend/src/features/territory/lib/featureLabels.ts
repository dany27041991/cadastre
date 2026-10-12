/**
 * Feature label resolution from GeoJSON properties (engine-agnostic).
 */
const LABEL_KEYS = [
  'name',
  'code',
  'istat_code',
  'vehicle_registration_code',
  'asset_type',
  'species',
] as const

export const DEFAULT_LABEL_SELECTED = 'Selected'

export function getFeatureLabel(
  props: Record<string, unknown>,
  id: unknown,
  fallbackLabel?: string
): string {
  for (const key of LABEL_KEYS) {
    const v = props[key]
    if (v != null && (typeof v === 'string' || typeof v === 'number')) {
      const s = String(v).trim()
      if (s !== '') return s
    }
  }
  return typeof id === 'number' ? `#${id}` : (fallbackLabel ?? DEFAULT_LABEL_SELECTED)
}
