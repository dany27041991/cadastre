import { useMemo, useRef } from 'react'
import type { MapBridge } from '@/features/territory/types/navigation'
import type { UseGeoinsightMapBridgeResult } from '@/features/territory-map-geoinsight'
import { createGeoinsightLeafStorage } from '@/features/territory-map-geoinsight/model/adapter/geoinsightLeafStorage'

/** MapBridge for territory navigation: Geoinsight adapter + leaf-area restore. */
export function useTerritoryMapBridge(map: UseGeoinsightMapBridgeResult): MapBridge {
  const leafStorageRef = useRef<ReturnType<typeof createGeoinsightLeafStorage>>()
  if (!leafStorageRef.current) {
    leafStorageRef.current = createGeoinsightLeafStorage()
  }
  const leaf = leafStorageRef.current

  return useMemo(
    () => ({
      loadGeoJson: map.loadGeoJson,
      loadGeoJsonAndShowOnlyFeatureById: map.loadGeoJsonAndShowOnlyFeatureById,
      fitToCurrentExtent: map.fitToCurrentExtent,
      showOnlyFeature: map.showOnlyFeature,
      panToLonLatKeepZoom: map.panToLonLatKeepZoom,
      panToLonLatAtScreenFraction: map.panToLonLatAtScreenFraction,
      zoomToLonLatAtScreenFraction: map.zoomToLonLatAtScreenFraction,
      setGreenDetailHighlight: map.setGreenDetailHighlight,
      clearGreenDetailHighlight: map.clearGreenDetailHighlight,
      discardGreenDetailHighlight: map.discardGreenDetailHighlight,
      loadGreenLayer: map.loadGreenLayer,
      loadGreenLayerViewport: map.loadGreenLayerViewport,
      loadGreenLayerFromFeature: map.loadGreenLayerFromFeature,
      setGreenLayerVisible: map.setGreenLayerVisible,
      clearGreenLayer: map.clearGreenLayer,
      clearTerritoryLayer: map.clearTerritoryLayer,
      clearMapVectorLayers: map.clearMapVectorLayers,
      fitToGreenExtent: map.fitToGreenExtent,
      setGreenLayerVisibleWhenMoveEnds: map.setGreenLayerVisibleWhenMoveEnds,
      ensureGreenLayerVisibleAfterFit: map.ensureGreenLayerVisibleAfterFit,
      setTerritoryFillVisible: map.setTerritoryFillVisible,
      storeLeafAreaForRestore: (areaId, feature) => leaf.store(areaId, feature),
      getStoredLeafArea: (areaId) => leaf.get(areaId),
      clearStoredLeafArea: () => leaf.clear(),
      syncDrillContext: map.syncDrillContext,
    }),
    [map, leaf]
  )
}
