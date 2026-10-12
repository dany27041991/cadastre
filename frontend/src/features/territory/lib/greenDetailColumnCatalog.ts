/**
 * Curated green table/detail column catalogs (aligned with BE metadata subset).
 * Spec: 2026-08-13-green-table-detail-columns-design.md
 */

export const AREA_DETAIL_COLUMNS = [
  'name',
  'area_code',
  'area_classification',
  'istat_classification',
  'intensity_of_fruition',
  'perimeter_type',
  'survey_date',
  'surface_area_m2',
] as const

export const ASSET_DETAIL_COLUMNS = [
  'plant_code',
  'species_code',
  'area_code',
  'latitude',
  'longitude',
  'survey_date',
  'species',
  'genus',
  'variety',
  'trunk_diameter_cm',
  'plant_height_m',
  'crown_diameter_m',
  'growth_stage',
  'protection_status',
  'health_status',
] as const

export const AREA_DEFAULT_VISIBLE = [
  'name',
  'area_classification',
  'istat_classification',
  'perimeter_type',
  'surface_area_m2',
] as const

export const ASSET_DEFAULT_VISIBLE = [
  'plant_code',
  'species',
  'genus',
  'trunk_diameter_cm',
  'health_status',
] as const

/** Derived / computed fields — not sortable in v1 CustomTable headers. */
export const NON_SORTABLE_DETAIL_COLUMNS = new Set([
  'surface_area_m2',
  'trunk_diameter_cm',
  'latitude',
  'longitude',
  'plant_height_m',
  'crown_diameter_m',
  'species_code',
])

export type GreenTableKind = 'area' | 'asset'

export function detailColumnsFor(kind: GreenTableKind): readonly string[] {
  return kind === 'asset' ? ASSET_DETAIL_COLUMNS : AREA_DETAIL_COLUMNS
}

export function defaultVisibleFor(kind: GreenTableKind): readonly string[] {
  return kind === 'asset' ? ASSET_DEFAULT_VISIBLE : AREA_DEFAULT_VISIBLE
}
