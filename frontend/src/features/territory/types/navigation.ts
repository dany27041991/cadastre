/**
 * Map bridge and navigation state/options.
 */
import type { TFunction } from 'i18next'
import type { GeoJSONFeatureCollection } from '@/shared/types'
import type { TerritoryNavigationApi } from './api'
import type { TerritoryLevel, BreadcrumbCrumb } from './territory'
import type { TerritoryMapFeature } from './mapFeature'

export interface MapBridgeGeo {
  loadGeoJson: (geojson: GeoJSONFeatureCollection) => void
  loadGeoJsonAndShowOnlyFeatureById: (
    geojson: GeoJSONFeatureCollection,
    featureId: number
  ) => void
  fitToCurrentExtent: () => void
}

export interface MapBridgeFeature {
  showOnlyFeature: (feature: TerritoryMapFeature) => void
}

export interface MapBridgeGreen {
  loadGreenLayer: (
    geojson: GeoJSONFeatureCollection,
    options?: { skipFit?: boolean }
  ) => void
  /** Server viewport mode: data fetched per bbox+zoom (national-scale rendering). */
  loadGreenLayerViewport: (
    fetcher: (
      bbox: [number, number, number, number],
      zoom: number
    ) => Promise<GeoJSONFeatureCollection>,
    areasFetcher?: (
      bbox: [number, number, number, number],
      zoom: number
    ) => Promise<GeoJSONFeatureCollection>
  ) => void
  /** Load a single feature into the green layer (e.g. leaf area with no sub-areas). */
  loadGreenLayerFromFeature: (
    feature: TerritoryMapFeature,
    options?: { skipFit?: boolean }
  ) => void
  setGreenLayerVisible: (visible: boolean) => void
  clearGreenLayer: () => void
  clearTerritoryLayer: () => void
  clearMapVectorLayers: () => void
  fitToGreenExtent: (includeTerritoryBbox?: boolean) => void
  setGreenLayerVisibleWhenMoveEnds: () => void
  ensureGreenLayerVisibleAfterFit: () => void
  /** Hide territory fill so green is not covered by gray during fit animation. */
  setTerritoryFillVisible: (visible: boolean) => void
  /** Store leaf area feature so it can be restored when navigating back via breadcrumb. */
  storeLeafAreaForRestore?: (areaId: number, feature: TerritoryMapFeature) => void
  getStoredLeafArea?: (areaId: number) => TerritoryMapFeature | null
  /** Clear stored leaf area (e.g. when navigating to region/province/municipality/sub-municipal area). */
  clearStoredLeafArea?: () => void
  /** Geoinsight: exclude expanded sub-area ids from click hit-test (parent outline vs children). */
  syncDrillContext: (excludeAreaIds: number[]) => void
}

export type MapBridge = MapBridgeGeo & MapBridgeFeature & MapBridgeGreen

export interface UseTerritoryNavigationOptions {
  api?: TerritoryNavigationApi
  /** Optional i18n translate; when provided, breadcrumb labels use translations. */
  t?: TFunction
  /**
   * When the green-assets toggle is on, green-level navigation must not replace
   * the viewport cluster layer with area polygons (that race killed clusters).
   */
  isAssetsLayerActive?: () => boolean
  /**
   * When false, drill-down must not mount green-area polygons (Aree Gestite off).
   * Defaults to true when omitted — preserves prior behaviour.
   */
  isAreasLayerActive?: () => boolean
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
  /** Re-apply map layers for the current breadcrumb level (after Geoinsight re-init). */
  resyncMapLayers: () => Promise<void>
}

export interface TerritoryNavigationActions {
  navigateTo: (index: number) => Promise<void>
  goBack: () => void
  handleFeatureSelect: (id: number, label: string, feature?: unknown) => void
}

export type UseTerritoryNavigationResult = TerritoryNavigationState &
  TerritoryNavigationLoaders &
  TerritoryNavigationActions
