/** Territory entity: administrative levels and breadcrumb. */

export type TerritoryLevel =
  | 'regions'
  | 'provinces'
  | 'municipalities'
  | 'sub_municipal_areas'
  | 'green_areas'
  | 'sub_areas'

export type SubMunicipalDrillLevel = 1 | 2 | 3

export interface BreadcrumbCrumb {
  level: TerritoryLevel
  id: number
  label: string
  navigable?: boolean
  subMunicipalAreaId?: number
  regionId?: number
  subMunicipalDrillLevel?: SubMunicipalDrillLevel
  subMunicipalDrillStack?: number[]
}
