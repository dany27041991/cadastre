/**
 * Interfaces for territory map hook: core API and green layer API.
 */
import type Feature from 'ol/Feature'
import type { GeoJSONFeatureCollection } from '../geojson'
import type { FeatureSelectHandler } from './handler.types'

export interface TerritoryMapCoreApi {
  mapRef: React.RefObject<HTMLDivElement | null>
  loadGeoJson: (geojson: GeoJSONFeatureCollection) => void
  fitToCurrentExtent: () => void
  centerOnItaly: () => void
  showOnlyFeature: (feature: Feature) => void
  setOnFeatureSelect: (handler: FeatureSelectHandler) => void
}

export interface TerritoryMapGreenApi {
  loadGreenLayer: (geojson: GeoJSONFeatureCollection) => void
  setGreenLayerVisible: (visible: boolean) => void
  clearGreenLayer: () => void
  fitToGreenExtent: () => void
  setTerritoryFillVisible: (visible: boolean) => void
}
