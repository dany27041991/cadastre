/**
 * Append InfoPanel applied column filters to a query string builder.
 * Never overlays territory scope / clip / dates / pagination keys.
 */

/** Keys that must never come from the filter form (design denylist). */
export const FILTER_SCOPE_DENYLIST: ReadonlySet<string> = new Set([
  'clip_wkt',
  'date_from',
  'date_to',
  'region_id',
  'province_id',
  'municipality_id',
  'area_id',
  'green_area_id',
  'sub_municipal_area_id',
  'contained_in_area_id',
  'parent_id',
  'bbox',
  'zoom',
  'format',
  'page',
  'page_size',
  'sort_by',
  'sort_dir',
])

/** Prefix for area filters on asset /viewport (BE collect_prefixed_filters). */
export const AREA_FILTER_QUERY_PREFIX = 'area__'

export function appendAppliedFilters(
  search: URLSearchParams,
  filters: Readonly<Record<string, string>> | null | undefined,
  prefix = '',
): void {
  if (!filters) return
  for (const [key, raw] of Object.entries(filters)) {
    if (FILTER_SCOPE_DENYLIST.has(key)) continue
    const value = raw?.trim()
    if (!value) continue
    search.set(`${prefix}${key}`, value)
  }
}
