/**
 * Geoinsight MapBridge facade — delegates to adapter submodules.
 */
import type { GeoJSONFeatureCollection } from '@/shared/types'
import type { MapBridge } from '@/features/territory/types/navigation'
import type {
  FeatureSelectHandler,
  GreenDetailSelectHandler,
} from '@/features/territory/types/map'
import type { TerritoryMapFeature } from '@/features/territory/types/mapFeature'
import type { GeoinsightGeometryClip } from '@/features/territory/lib/geoJsonToGeoinsight'
import { GeometryRegistry } from '../geometryRegistry'
import type { GeoinsightGreenLayerHost } from './geoinsightGreenLayers'
import {
  clearGreenLayer,
  ensureGreenLayerVisibleAfterFit,
  fitGreenExtent,
  getGreenLayerFeatures,
  loadGreenLayer,
  loadGreenLayerFromFeature,
  loadGreenLayerViewport,
  setGreenLayerVisible,
  setGreenLayerVisibleWhenMoveEnds,
} from './geoinsightGreenLayers'
import type { GreenViewportFetcher } from './geoinsightGreenCluster'
import { onGreenAssetMapViewChange, onGreenAssetMapZoomChange } from './geoinsightGreenCluster'
import {
  activateGeoinsightDrawnGeometryInfo,
  addGeoinsightGeometries,
  flushGeoinsightPending,
  removeGeoinsightGeomIds,
  type GeoinsightMapRuntimeHost,
} from './geoinsightMapRuntime'
import {
  syncGeoinsightZoomFromMap,
  panGeoinsightToLonLatKeepZoom,
  panGeoinsightToLonLatAtScreenFraction,
  zoomGeoinsightToLonLatAtScreenFraction,
} from './geoinsightMapViewport'
import {
  clearGreenDetailHighlight as clearDetailHighlightGeom,
  discardGreenDetailHighlight as discardDetailHighlightGeom,
  setGreenDetailHighlight as setDetailHighlightGeom,
} from './geoinsightDetailHighlight'
import {
  clearAllVectorLayers,
  clearTerritoryLayer,
  fitTerritoryExtent,
  loadTerritoryGeoJson,
  loadTerritoryGeoJsonAndShowOnlyFeatureById,
  setTerritoryFillVisible,
  showOnlyTerritoryFeature,
} from './geoinsightTerritoryLayers'
import {
  handleDrawnGeometryInfo as handleDrawnGeometryInfoEvent,
  handleFeatureInfo as handleFeatureInfoEvent,
  selectByGeomId,
  syncDrillContext as syncDrillContextState,
} from './geoinsightMapSelection'

type PendingOp = () => void

export interface GeoinsightMapAdapterOptions {
  registry: GeometryRegistry
  onFeatureSelectRef: { current: FeatureSelectHandler }
  onGreenDetailSelectRef: { current: GreenDetailSelectHandler }
  isClickNavigationEnabledRef: { current: () => boolean }
}

export class GeoinsightMapAdapter implements GeoinsightMapRuntimeHost, GeoinsightGreenLayerHost {
  readonly registry: GeometryRegistry
  readonly onFeatureSelectRef: { current: FeatureSelectHandler }
  readonly onGreenDetailSelectRef: { current: GreenDetailSelectHandler }
  readonly isClickNavigationEnabledRef: { current: () => boolean }
  readonly pending: PendingOp[] = []
  lastTerritoryGeometries: GeoinsightGeometryClip[] = []
  lastTerritoryFitBbox: [number, number, number, number] | null = null
  greenAssetClusteringActive = false
  lastAppliedGreenAssetZoom: number | null = null
  lastGreenGeometries: GeoinsightGeometryClip[] = []
  lastGreenShowClusterCountLabels = false
  lastAppliedViewportBbox: [number, number, number, number] | null = null
  lastAppliedRawMode = false
  greenViewportFetcher: GreenViewportFetcher | null = null
  greenViewportAreasFetcher: GreenViewportFetcher | null = null
  greenViewportRequestSeq = 0
  greenLayerVisible = true
  greenRevealGen = 0
  drillExcludeAreaIds: number[] = []
  detailHighlightGeomIds: string[] = []
  detailHighlightFeature: TerritoryMapFeature | null = null
  detailHighlightRestoreClip: import('@/features/territory/lib/geoJsonToGeoinsight').GeoinsightGeometryClip | null =
    null
  detailHighlightUsedMounted = false

  constructor(options: GeoinsightMapAdapterOptions) {
    this.registry = options.registry
    this.onFeatureSelectRef = options.onFeatureSelectRef
    this.onGreenDetailSelectRef = options.onGreenDetailSelectRef
    this.isClickNavigationEnabledRef = options.isClickNavigationEnabledRef
  }

  flushPending(): void {
    flushGeoinsightPending(this)
  }

  activateDrawnGeometryInfo(): void {
    activateGeoinsightDrawnGeometryInfo(this)
  }

  removeGeomIds(ids: string[]): void {
    removeGeoinsightGeomIds(ids, this)
  }

  addGeometries(geometries: GeoinsightGeometryClip[], options?: { showLabels?: boolean }): void {
    addGeoinsightGeometries(this, geometries, options)
  }

  handleFeatureInfo(event: unknown): void {
    handleFeatureInfoEvent(this, event, (geomId) => this.selectByGeomId(geomId))
  }

  handleDrawnGeometryInfo(
    _mapId: number,
    _coordinates: number[],
    _epsg: string,
    features: unknown
  ): void {
    handleDrawnGeometryInfoEvent(this, features, (geomId) => this.selectByGeomId(geomId))
  }

  syncDrillContext(excludeAreaIds: number[]): void {
    syncDrillContextState(this, excludeAreaIds)
  }

  private selectByGeomId(geomId: string): void {
    selectByGeomId(this, geomId)
  }

  onMapZoomChange(zoom: number): void {
    onGreenAssetMapZoomChange(this, zoom)
  }

  onMapViewChange(): void {
    onGreenAssetMapViewChange(this)
  }

  syncZoomFromMap(): void {
    syncGeoinsightZoomFromMap()
  }

  asMapBridge(): MapBridge & {
    setOnFeatureSelect: (handler: FeatureSelectHandler) => void
    setOnGreenDetailSelect: (handler: GreenDetailSelectHandler) => void
    getGreenLayerFeatures: () => TerritoryMapFeature[]
    handleFeatureInfo: (event: unknown) => void
    handleDrawnGeometryInfo: (
      mapId: number,
      coordinates: number[],
      epsg: string,
      features: unknown
    ) => void
    activateDrawnGeometryInfo: () => void
    flushPending: () => void
  } {
    return {
      loadGeoJson: (geojson) => loadTerritoryGeoJson(this, geojson),
      loadGeoJsonAndShowOnlyFeatureById: (geojson, featureId) =>
        loadTerritoryGeoJsonAndShowOnlyFeatureById(this, geojson, featureId),
      fitToCurrentExtent: () => fitTerritoryExtent(this),
      showOnlyFeature: (feature) => showOnlyTerritoryFeature(this, feature),
      panToLonLatKeepZoom: (lon, lat) => panGeoinsightToLonLatKeepZoom(this, lon, lat),
      panToLonLatAtScreenFraction: (lon, lat, fractionX, fractionY) =>
        panGeoinsightToLonLatAtScreenFraction(this, lon, lat, fractionX, fractionY),
      zoomToLonLatAtScreenFraction: (lon, lat, options) =>
        zoomGeoinsightToLonLatAtScreenFraction(this, lon, lat, options),
      loadGreenLayer: (geojson, options) => loadGreenLayer(this, geojson, options),
      loadGreenLayerViewport: (fetcher, areasFetcher) =>
        loadGreenLayerViewport(this, fetcher, areasFetcher),
      loadGreenLayerFromFeature: (feature, options) =>
        loadGreenLayerFromFeature(this, feature, options),
      setGreenLayerVisible: (visible) => setGreenLayerVisible(this, visible),
      clearGreenLayer: () => clearGreenLayer(this),
      clearTerritoryLayer: () => clearTerritoryLayer(this),
      clearMapVectorLayers: () => clearAllVectorLayers(this),
      fitToGreenExtent: (includeTerritoryBbox?: boolean) =>
        fitGreenExtent(this, includeTerritoryBbox ?? true),
      setGreenLayerVisibleWhenMoveEnds: () => setGreenLayerVisibleWhenMoveEnds(this),
      ensureGreenLayerVisibleAfterFit: () => ensureGreenLayerVisibleAfterFit(this),
      setTerritoryFillVisible: (visible) => setTerritoryFillVisible(this, visible),
      setOnFeatureSelect: (handler) => {
        this.onFeatureSelectRef.current = handler
      },
      setOnGreenDetailSelect: (handler) => {
        this.onGreenDetailSelectRef.current = handler
      },
      getGreenLayerFeatures: () => getGreenLayerFeatures(this),
      handleFeatureInfo: (event) => this.handleFeatureInfo(event),
      handleDrawnGeometryInfo: (mapId, coordinates, epsg, features) =>
        this.handleDrawnGeometryInfo(mapId, coordinates, epsg, features),
      activateDrawnGeometryInfo: () => this.activateDrawnGeometryInfo(),
      flushPending: () => this.flushPending(),
      syncDrillContext: (excludeAreaIds) => this.syncDrillContext(excludeAreaIds),
      setGreenDetailHighlight: (feature, options) =>
        setDetailHighlightGeom(this, feature, options),
      clearGreenDetailHighlight: () => clearDetailHighlightGeom(this),
      discardGreenDetailHighlight: () => discardDetailHighlightGeom(this),
    }
  }

  loadGeoJson(geojson: GeoJSONFeatureCollection): void {
    loadTerritoryGeoJson(this, geojson)
  }

  loadGeoJsonAndShowOnlyFeatureById(
    geojson: GeoJSONFeatureCollection,
    featureId: number
  ): void {
    loadTerritoryGeoJsonAndShowOnlyFeatureById(this, geojson, featureId)
  }

  fitToCurrentExtent(): void {
    fitTerritoryExtent(this)
  }

  showOnlyFeature(feature: TerritoryMapFeature): void {
    showOnlyTerritoryFeature(this, feature)
  }

  panToLonLatKeepZoom(lon: number, lat: number): void {
    panGeoinsightToLonLatKeepZoom(this, lon, lat)
  }

  panToLonLatAtScreenFraction(
    lon: number,
    lat: number,
    fractionX?: number,
    fractionY?: number
  ): void {
    panGeoinsightToLonLatAtScreenFraction(this, lon, lat, fractionX, fractionY)
  }

  zoomToLonLatAtScreenFraction(
    lon: number,
    lat: number,
    options?: {
      bbox?: [number, number, number, number] | null
      fractionX?: number
      fractionY?: number
      keepZoom?: boolean
      forceMaxZoom?: boolean
    }
  ): void {
    zoomGeoinsightToLonLatAtScreenFraction(this, lon, lat, options)
  }

  setGreenDetailHighlight(
    feature: TerritoryMapFeature,
    options?: { preferAsset?: boolean }
  ): void {
    setDetailHighlightGeom(this, feature, options)
  }

  clearGreenDetailHighlight(): void {
    clearDetailHighlightGeom(this)
  }

  discardGreenDetailHighlight(): void {
    discardDetailHighlightGeom(this)
  }

  loadGreenLayer(
    geojson: GeoJSONFeatureCollection,
    options?: { skipFit?: boolean }
  ): void {
    loadGreenLayer(this, geojson, options)
  }

  loadGreenLayerViewport(
    fetcher: GreenViewportFetcher,
    areasFetcher?: GreenViewportFetcher
  ): void {
    loadGreenLayerViewport(this, fetcher, areasFetcher)
  }

  loadGreenLayerFromFeature(
    feature: TerritoryMapFeature,
    options?: { skipFit?: boolean }
  ): void {
    loadGreenLayerFromFeature(this, feature, options)
  }

  getGreenLayerFeatures(): TerritoryMapFeature[] {
    return getGreenLayerFeatures(this)
  }

  setGreenLayerVisible(visible: boolean): void {
    setGreenLayerVisible(this, visible)
  }

  setGreenLayerVisibleWhenMoveEnds(): void {
    setGreenLayerVisibleWhenMoveEnds(this)
  }

  ensureGreenLayerVisibleAfterFit(): void {
    ensureGreenLayerVisibleAfterFit(this)
  }

  clearGreenLayer(): void {
    clearGreenLayer(this)
  }

  clearTerritoryLayer(): void {
    clearTerritoryLayer(this)
  }

  clearMapVectorLayers(): void {
    clearAllVectorLayers(this)
  }

  fitToGreenExtent(includeTerritoryBbox = true): void {
    fitGreenExtent(this, includeTerritoryBbox)
  }

  setTerritoryFillVisible(visible: boolean): void {
    setTerritoryFillVisible(this, visible)
  }
}
