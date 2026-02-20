/**
 * Interfaces for map UI components: MapHeader, GreenPalette.
 */
import type { TerritoryLevel, BreadcrumbCrumb } from '@/shared/types/territory'

export interface GreenContext {
  regionId: number
  municipalityId: number
  districtId?: number
  greenAreaId?: number
}

export interface GreenPaletteProps {
  readonly breadcrumb: BreadcrumbCrumb[]
  readonly level: string
  readonly loadGreenLayer: (geojson: { type: string; features: unknown[] }) => void
  readonly setGreenLayerVisible: (visible: boolean) => void
  readonly clearGreenLayer: () => void
  readonly fitToGreenExtent: () => void
  readonly setTerritoryFillVisible: (visible: boolean) => void
}

export interface MapHeaderProps {
  level: TerritoryLevel
  breadcrumb: BreadcrumbCrumb[]
  loading: boolean
  onLoadRegions: () => void
  onNavigateTo: (index: number) => void
  onGoBack: () => void
}
