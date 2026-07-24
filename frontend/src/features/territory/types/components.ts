/**
 * UI component props for territory feature.
 */
import type { TerritoryLevel, BreadcrumbCrumb } from './territory'

/** Administrative scope for green data; all fields optional (empty = nationwide). */
export interface GreenContext {
  regionId?: number
  provinceId?: number
  municipalityId?: number
  subMunicipalAreaId?: number
  greenAreaId?: number
}

export interface MapHeaderProps {
  readonly level: TerritoryLevel
  readonly breadcrumb: BreadcrumbCrumb[]
  readonly loading: boolean
  readonly onLoadRegions: () => void
  readonly onNavigateTo: (index: number) => void
  readonly onGoBack: () => void
}

export interface MapBreadcrumbsProps {
  readonly level: TerritoryLevel
  readonly breadcrumb: BreadcrumbCrumb[]
  readonly onLoadRegions: () => void
  readonly onNavigateTo: (index: number) => void
}
