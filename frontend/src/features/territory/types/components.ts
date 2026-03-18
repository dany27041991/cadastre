/**
 * UI component props for territory feature.
 */
import type { GeoJSONFeatureCollection } from '@/shared/types'
import type { TerritoryLevel, BreadcrumbCrumb } from './territory'

export interface GreenContext {
  regionId: number
  provinceId?: number
  municipalityId: number
  subMunicipalAreaId?: number
  greenAreaId?: number
}

export interface GreenPaletteProps {
  readonly breadcrumb: BreadcrumbCrumb[]
  readonly level: string
  readonly loadGreenLayer: (
    geojson: GeoJSONFeatureCollection,
    options?: { skipClustering?: boolean }
  ) => void
  readonly setGreenLayerVisible: (visible: boolean) => void
  readonly clearGreenLayer: () => void
  /** When at green_areas/sub_areas: restore green areas in the layer (e.g. after turning off trees). */
  readonly restoreGreenAreas?: () => Promise<void>
  readonly fitToGreenExtent: () => void
  readonly setTerritoryFillVisible: (visible: boolean) => void
  /** Called before loading assets so the widget can save the current area (e.g. leaf) for later restore. */
  readonly onBeforeLoadingAssets?: () => void
  /** Controlled: green assets layer on (drives table mode). */
  readonly assetsLayerActive: boolean
  readonly onAssetsLayerActiveChange: (active: boolean) => void
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
