/**
 * Green table filter field config: enum selects + layout rows + control kinds.
 * Catalog keys align with greenDetailColumnCatalog / column picker.
 * Numerics (surface, diameters, heights) and survey_date use min/max or from/to.
 */
import type { GreenTableKind } from './greenDetailColumnCatalog'

export type FilterControlKind =
  | 'enum'
  | 'date'
  | 'date-range'
  | 'number'
  | 'number-range'
  | 'integer'
  | 'text'

/** Enum values sent as filter query params (DB enum labels). */
export const FILTER_ENUM_VALUES: Readonly<Record<string, readonly string[]>> = {
  area_classification: [
    'HISTORICAL_GREEN',
    'URBAN_PARKS',
    'EQUIPPED_GREEN',
    'URBAN_FURNISHING',
    'SCHOOL_GARDENS',
    'OUTDOOR_SPORTS',
    'URBAN_FORESTRY',
    'WOODLAND',
    'UNCULTIVATED_GREEN',
    'URBAN_ALLOTMENTS',
    'BOTANICAL_GARDENS',
    'ZOOLOGICAL_GARDENS',
    'CEMETERIES',
    'OTHER',
  ],
  istat_classification: [
    'HISTORICAL_GREEN',
    'URBAN_PARKS',
    'EQUIPPED_GREEN',
    'URBAN_FURNISHING',
    'SCHOOL_GARDENS',
    'OUTDOOR_SPORTS',
    'URBAN_FORESTRY',
    'WOODLAND',
    'UNCULTIVATED_GREEN',
    'URBAN_ALLOTMENTS',
    'BOTANICAL_GARDENS',
    'ZOOLOGICAL_GARDENS',
    'CEMETERIES',
    'OTHER',
  ],
  intensity_of_fruition: ['NONE', 'LOW', 'MEDIUM', 'HIGH'],
  perimeter_type: ['REAL', 'FICTITIOUS'],
  growth_stage: ['YOUNG', 'SEMI_MATURE', 'MATURE', 'OVERMATURE', 'DEAD'],
  protection_status: ['NONE', 'PROTECTED', 'MONUMENTAL', 'HISTORICAL'],
  health_status: ['UNKNOWN', 'HEALTHY', 'DEGRADED', 'DECLINING', 'SICK', 'DECEASED'],
}

/**
 * Layout rows: each inner array is one visual row.
 * Range fields (min/max or from/to) always occupy a full row alone;
 * other controls share rows side-by-side.
 */
export const AREA_FILTER_LAYOUT: readonly (readonly string[])[] = [
  ['name', 'area_code'],
  ['surface_area_m2'],
  ['survey_date'],
  ['area_classification', 'istat_classification'],
  ['intensity_of_fruition', 'perimeter_type'],
]

export const ASSET_FILTER_LAYOUT: readonly (readonly string[])[] = [
  ['plant_code', 'area_code', 'species_code'],
  ['latitude', 'longitude'],
  ['species', 'genus', 'variety'],
  ['trunk_diameter_cm'],
  ['plant_height_m'],
  ['crown_diameter_m'],
  ['survey_date'],
  ['growth_stage', 'protection_status', 'health_status'],
]

/** Base keys that serialize as ``*_min`` / ``*_max``. */
export const RANGE_NUMBER_BASE_KEYS: ReadonlySet<string> = new Set([
  'surface_area_m2',
  'trunk_diameter_cm',
  'plant_height_m',
  'crown_diameter_m',
])

/** Base keys that serialize as ``*_from`` / ``*_to``. */
export const RANGE_DATE_BASE_KEYS: ReadonlySet<string> = new Set(['survey_date'])

const SINGLE_NUMBER_KEYS = new Set(['latitude', 'longitude'])

export function filterLayoutFor(kind: GreenTableKind): readonly (readonly string[])[] {
  return kind === 'asset' ? ASSET_FILTER_LAYOUT : AREA_FILTER_LAYOUT
}

export function isEnumFilterKey(key: string): boolean {
  return Object.prototype.hasOwnProperty.call(FILTER_ENUM_VALUES, key)
}

export function filterControlKind(kind: GreenTableKind, key: string): FilterControlKind {
  if (isEnumFilterKey(key)) return 'enum'
  if (RANGE_DATE_BASE_KEYS.has(key)) return 'date-range'
  if (RANGE_NUMBER_BASE_KEYS.has(key)) return 'number-range'
  if (SINGLE_NUMBER_KEYS.has(key)) return 'number'
  if (key === 'plant_code') return 'integer'
  // Asset area_code filters by green_area_id (int); area area_code is ZRIL text.
  if (key === 'area_code' && kind === 'asset') return 'integer'
  return 'text'
}

export function rangeMinKey(base: string): string {
  return `${base}_min`
}

export function rangeMaxKey(base: string): string {
  return `${base}_max`
}

export function rangeFromKey(base: string): string {
  return `${base}_from`
}

export function rangeToKey(base: string): string {
  return `${base}_to`
}

/** Parse YYYY-MM-DD (or ISO) filter string to Date for DatePicker. */
export function parseFilterDate(value: string): Date | null {
  const v = value.trim()
  if (!v) return null
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(v)
  if (!m) return null
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
  return Number.isNaN(d.getTime()) ? null : d
}

/** Serialize DatePicker value to YYYY-MM-DD for BE date range. */
export function formatFilterDate(date: Date | null): string {
  if (!date || Number.isNaN(date.getTime())) return ''
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function parseFilterNumber(value: string): number | null {
  const v = value.trim().replace(',', '.')
  if (!v) return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

export type InvalidFilterRange = {
  readonly kind: GreenTableKind
  readonly baseKey: string
}

/**
 * Returns the first inverted range (min>max or from>to) across area/asset drafts.
 * Empty ends are allowed (open-ended range).
 */
export function findInvalidFilterRange(
  area: Readonly<Record<string, string>>,
  asset: Readonly<Record<string, string>>,
): InvalidFilterRange | null {
  for (const kind of ['area', 'asset'] as const) {
    const filters = kind === 'area' ? area : asset
    for (const base of RANGE_NUMBER_BASE_KEYS) {
      const loRaw = filters[rangeMinKey(base)]?.trim() ?? ''
      const hiRaw = filters[rangeMaxKey(base)]?.trim() ?? ''
      if (!loRaw || !hiRaw) continue
      const lo = parseFilterNumber(loRaw)
      const hi = parseFilterNumber(hiRaw)
      if (lo == null || hi == null) continue
      if (lo > hi) return { kind, baseKey: base }
    }
    for (const base of RANGE_DATE_BASE_KEYS) {
      const fromRaw = filters[rangeFromKey(base)]?.trim() ?? ''
      const toRaw = filters[rangeToKey(base)]?.trim() ?? ''
      if (!fromRaw || !toRaw) continue
      if (fromRaw > toRaw) return { kind, baseKey: base }
    }
  }
  return null
}
