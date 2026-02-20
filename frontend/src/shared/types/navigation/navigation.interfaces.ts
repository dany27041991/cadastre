/**
 * Interfaces for territory navigation: map bridge, state, loaders and actions.
 */
import type { TerritoryNavigationApi } from '../api'
import type { TerritoryLevel, BreadcrumbCrumb } from '../territory'

export interface MapBridgeGeo {
  loadGeoJson: (geojson: { type: string; features: unknown[] }) => void
  fitToCurrentExtent: () => void
  centerOnItaly: () => void
}

export interface MapBridgeFeature {
  showOnlyFeature: (feature: unknown) => void
}

export interface UseTerritoryNavigationOptions {
  api?: TerritoryNavigationApi
}

export interface TerritoryNavigationState {
  level: TerritoryLevel
  breadcrumb: BreadcrumbCrumb[]
  loading: boolean
}

export interface TerritoryNavigationLoaders {
  loadRegions: () => Promise<void>
  loadProvinces: (regionId: number, label: string) => Promise<void>
  loadMunicipalities: (provinceId: number, label: string) => Promise<void>
  loadDistricts: (
    regionId: number,
    municipalityId: number,
    label: string,
    clickedFeature?: unknown
  ) => Promise<void>
  loadGreenAreas: (
    regionId: number,
    municipalityId: number,
    districtLabel: string,
    districtId?: number,
    clickedFeature?: unknown
  ) => Promise<void>
  loadSubAreas: (
    areaId: number,
    regionId: number,
    label: string,
    clickedFeature?: unknown
  ) => Promise<void>
}

export interface TerritoryNavigationActions {
  navigateTo: (index: number) => Promise<void>
  goBack: () => void
  handleFeatureSelect: (id: number, label: string, feature?: unknown) => void
}
