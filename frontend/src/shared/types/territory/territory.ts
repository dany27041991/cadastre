/** Administrative / area level in the territory hierarchy. */
export type TerritoryLevel =
  | 'regions'
  | 'provinces'
  | 'municipalities'
  | 'districts'
  | 'green_areas'
  | 'sub_areas'

/** Single entry in the navigation breadcrumb. */
export interface BreadcrumbCrumb {
  level: TerritoryLevel
  id: number
  label: string
  /** For green_areas: selected district (optional). */
  districtId?: number
  /** For green_areas and sub_areas: region (required for partitioned API). */
  regionId?: number
}
