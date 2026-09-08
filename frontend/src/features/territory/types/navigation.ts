/**
 * Map bridge and navigation state/options.
 */
import type { TFunction } from 'i18next'
import type { GeoJSONFeatureCollection } from '@/shared/types'
import type { TerritoryNavigationApi } from './api'
import type { TerritoryLevel, BreadcrumbCrumb } from './territory'
import type { TerritoryMapFeature } from './mapFeature'
import type { TerritorySearchHit } from './territorySearch'
import type { MapLayerKind } from '../model/constants'

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
  /**
   * Pan map so lon/lat is at the viewport center, keeping current zoom.
   * Used to frame green detail panel above the selected feature.
   */
  panToLonLatKeepZoom: (lon: number, lat: number) => void
  /**
   * Pan (keep zoom) so lon/lat lands at a map-viewport fraction (0–1).
   * Green detail uses (0.5, 0.2) — horizontal center, 20% from top.
   */
  panToLonLatAtScreenFraction: (
    lon: number,
    lat: number,
    fractionX?: number,
    fractionY?: number
  ) => void
  /**
   * Zoom to fit optional bbox and place lon/lat at a viewport fraction.
   * Used when opening green detail so the selected object is framed under the panel.
   */
  zoomToLonLatAtScreenFraction: (
    lon: number,
    lat: number,
    options?: {
      bbox?: [number, number, number, number] | null
      fractionX?: number
      fractionY?: number
      keepZoom?: boolean
      forceMaxZoom?: boolean
    }
  ) => void
  /** Red outline on the selected green feature while the detail modal is open. */
  setGreenDetailHighlight: (
    feature: TerritoryMapFeature,
    options?: { preferAsset?: boolean }
  ) => void
  clearGreenDetailHighlight: () => void
  /** Remove red selection without restoring the green clip (layer teardown). */
  discardGreenDetailHighlight: () => void
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

export interface MapBridgeDraw {
  activateDrawPolygon: (color: string) => void
  deactivateDrawGeometry: () => void
  deleteAllDrawnGeometries: () => void
  restrictSimpleDrawToClosedShapes: () => void
  restoreSimpleDrawTools: () => void
  clearSimpleDrawGeometries: () => void
  deactivateSimpleDrawTool: () => void
  styleSimpleDrawOutline: (color: string) => void
  keepOnlyLastSimpleDrawGeometry: () => void
  setKeepSimpleDrawClipFeatures: (keep: boolean) => void
  persistDrawClip: (wkt: string, color?: string) => void
  clearDrawClip: () => void
  zoomToWgs84Bbox: (bbox: [number, number, number, number]) => void
}

export type MapBridge = MapBridgeGeo & MapBridgeFeature & MapBridgeGreen & MapBridgeDraw

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
  /** Ingest window ISO dates for green catalog GET (lakehouse-required). */
  dateFromIso?: string
  dateToIso?: string
}

export interface TerritoryNavigationState {
  level: TerritoryLevel
  breadcrumb: BreadcrumbCrumb[]
  loading: boolean
}

export interface TerritoryNavigationLoaders {
  /** @param options.fit when false, keep current zoom (Area Italia). Default true. */
  loadRegions: (options?: { fit?: boolean }) => Promise<void>
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
  handleFeatureSelect: (
    id: number,
    label: string,
    feature?: unknown,
    layerKind?: MapLayerKind
  ) => void
  /** Drill into green area sub-areas (from detail modal CTA). */
  drillGreenArea: (areaId: number, label: string, feature?: unknown) => void
  /** Jump from hierarchy SearchInput (bypasses overlay click guard). */
  jumpToSearchHit: (hit: TerritorySearchHit) => Promise<void>
}

export type UseTerritoryNavigationResult = TerritoryNavigationState &
  TerritoryNavigationLoaders &
  TerritoryNavigationActions
