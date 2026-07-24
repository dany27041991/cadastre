/**
 * Geoinsight MapBridge hook.
 */
import { useEffect, useMemo, useRef } from 'react'
import { useGeoinsightStore } from '@/app/store/useGeoinsightStore'
import type { FeatureSelectHandler } from '@/features/territory/types/map'
import type { MapBridge } from '@/features/territory/types/navigation'
import { GeometryRegistry } from '../geometryRegistry'
import { GeoinsightMapAdapter } from '../adapter/geoinsightMapAdapter'

export interface UseGeoinsightMapBridgeResult extends MapBridge {
  setOnFeatureSelect: (handler: FeatureSelectHandler) => void
  getGreenLayerFeatures: () => import('@/features/territory/types/mapFeature').TerritoryMapFeature[]
  handleFeatureInfo: (event: unknown) => void
  handleDrawnGeometryInfo: (
    mapId: number,
    coordinates: number[],
    epsg: string,
    features: unknown
  ) => void
  flushAdapterPending: () => void
  syncDrillContext: (excludeAreaIds: number[]) => void
}

export function useGeoinsightMapBridge(): UseGeoinsightMapBridgeResult {
  const registryRef = useRef<GeometryRegistry>()
  if (!registryRef.current) registryRef.current = new GeometryRegistry()

  const onFeatureSelectRef = useRef<FeatureSelectHandler>(() => {})
  const adapterRef = useRef<GeoinsightMapAdapter>()
  if (!adapterRef.current) {
    adapterRef.current = new GeoinsightMapAdapter({
      registry: registryRef.current,
      onFeatureSelectRef,
    })
  }

  const bridge = useMemo(() => adapterRef.current!.asMapBridge(), [])
  const isMapReady = useGeoinsightStore((s) => s.isMapReady)
  const mapZoom = useGeoinsightStore((s) => s.mapZoom)
  const mapViewEpoch = useGeoinsightStore((s) => s.mapViewEpoch)

  useEffect(() => {
    if (isMapReady) bridge.flushPending()
  }, [isMapReady, bridge])

  useEffect(() => {
    if (mapZoom == null) return
    adapterRef.current?.onMapZoomChange(mapZoom)
  }, [mapZoom])

  useEffect(() => {
    if (!isMapReady) return
    adapterRef.current?.onMapViewChange()
  }, [mapViewEpoch, isMapReady])

  return {
    ...bridge,
    handleFeatureInfo: bridge.handleFeatureInfo,
    handleDrawnGeometryInfo: bridge.handleDrawnGeometryInfo,
    flushAdapterPending: bridge.flushPending,
    syncDrillContext: bridge.syncDrillContext,
  }
}
