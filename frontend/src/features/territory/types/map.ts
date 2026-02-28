/**
 * Territory map hook: core API and green layer API.
 */
import type Feature from 'ol/Feature'
import type { GeoJSONFeatureCollection } from '@/shared/types'

export type FeatureSelectHandler = (
  id: number,
  label: string,
  feature?: Feature
) => void

export interface TerritoryMapCoreApi {
  mapRef: React.RefObject<HTMLDivElement | null>
  loadGeoJson: (geojson: GeoJSONFeatureCollection) => void
  loadGeoJsonAndShowOnlyFeatureById: (
    geojson: GeoJSONFeatureCollection,
    featureId: number
  ) => void
  fitToCurrentExtent: () => void
  centerOnItaly: () => void
  showOnlyFeature: (feature: Feature) => void
  setOnFeatureSelect: (handler: FeatureSelectHandler) => void
}

export interface TerritoryMapGreenApi {
  loadGreenLayer: (
    geojson: GeoJSONFeatureCollection,
    options?: { skipClustering?: boolean }
  ) => void
  loadGreenLayerFromFeature: (feature: Feature) => void
  /** Current green layer features (e.g. to save the single area before loading assets at leaf level). */
  getGreenLayerFeatures: () => Feature[]
  setGreenLayerVisible: (visible: boolean) => void
  clearGreenLayer: () => void
  /** Clears the territory vector layer so the previous single-feature view is not left visible. */
  clearTerritoryLayer: () => void
  /** Clears green + territory layers and forces map repaint (use when navigating to admin level). */
  clearMapVectorLayers: () => void
  fitToGreenExtent: () => void
  /** Show green layer when the next moveend fires (after zoom/fit animation). */
  setGreenLayerVisibleWhenMoveEnds: () => void
  setTerritoryFillVisible: (visible: boolean) => void
}

export type UseTerritoryMapResult = TerritoryMapCoreApi & TerritoryMapGreenApi
