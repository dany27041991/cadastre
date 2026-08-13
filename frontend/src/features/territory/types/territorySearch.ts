/** Hit from GET /api/territory/search (hierarchy typeahead). */

export type TerritorySearchLevel =
  | 'italy'
  | 'regions'
  | 'provinces'
  | 'municipalities'
  | 'sub_municipal_areas'
  | 'green_areas'
  | 'sub_areas'

export interface TerritorySearchHit {
  readonly value: string
  readonly label: string
  readonly level: TerritorySearchLevel
  readonly id: number | null
  readonly region_id: number | null
  readonly province_id: number | null
  readonly municipality_id: number | null
  readonly sub_municipal_area_id: number | null
  readonly green_area_id: number | null
}

export interface TerritorySearchResponse {
  readonly items: readonly TerritorySearchHit[]
}
