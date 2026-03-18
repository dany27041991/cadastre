/**
 * Map bridge and navigation state/options.
 */
import type Feature from 'ol/Feature'
import type { TFunction } from 'i18next'
import type { GeoJSONFeatureCollection } from '@/shared/types'
import type { TerritoryNavigationApi } from './api'
import type { TerritoryLevel, BreadcrumbCrumb } from './territory'

export interface MapBridgeGeo {
  loadGeoJson: (geojson: GeoJSONFeatureCollection) => void
  loadGeoJsonAndShowOnlyFeatureById: (
    geojson: GeoJSONFeatureCollection,
    featureId: number
  ) => void
  fitToCurrentExtent: () => void
  centerOnItaly: () => void
}

export interface MapBridgeFeature {
  showOnlyFeature: (feature: Feature) => void
}

export interface MapBridgeGreen {
  loadGreenLayer: (
    geojson: GeoJSONFeatureCollection,
    options?: { skipClustering?: boolean }
  ) => void
  /** Load a single feature into the green layer (e.g. leaf area with no sub-areas). */
  loadGreenLayerFromFeature: (feature: Feature) => void
  setGreenLayerVisible: (visible: boolean) => void
  clearGreenLayer: () => void
  clearTerritoryLayer: () => void
  clearMapVectorLayers: () => void
  fitToGreenExtent: () => void
  setGreenLayerVisibleWhenMoveEnds: () => void
  ensureGreenLayerVisibleAfterFit: () => void
  /** Hide territory fill so green is not covered by gray during fit animation. */
  setTerritoryFillVisible: (visible: boolean) => void
  /** Store leaf area feature so it can be restored when navigating back via breadcrumb. */
  storeLeafAreaForRestore?: (areaId: number, feature: Feature) => void
  /** Retrieve stored leaf area for sub_areas level (returns null if not found or id mismatch). */
  getStoredLeafArea?: (areaId: number) => Feature | null
  /** Clear stored leaf area (e.g. when navigating to region/province/municipality/sub-municipal area). */
  clearStoredLeafArea?: () => void
}

export type MapBridge = MapBridgeGeo & MapBridgeFeature & MapBridgeGreen

export interface UseTerritoryNavigationOptions {
  api?: TerritoryNavigationApi
  /** Optional i18n translate; when provided, breadcrumb labels use translations. */
  t?: TFunction
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
  loadSubMunicipalAreas: (
    regionId: number,
    municipalityId: number,
    label: string,
    clickedFeature?: unknown
  ) => Promise<void>
  loadGreenAreas: (
    regionId: number,
    municipalityId: number,
    subMunicipalAreaLabel: string,
    subMunicipalAreaId?: number,
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

export type UseTerritoryNavigationResult = TerritoryNavigationState &
  TerritoryNavigationLoaders &
  TerritoryNavigationActions
