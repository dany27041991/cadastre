import { useCallback, useEffect, useRef } from 'react'
import { LEVEL_GREEN_AREAS, LEVEL_SUB_AREAS } from '@/features/territory'
import type { TerritoryLevel, BreadcrumbCrumb } from '@/features/territory/types'
import type { UseGeoinsightMapBridgeResult } from '@/features/territory-map-geoinsight'

interface UseTerritoryMapResyncOptions {
  map: UseGeoinsightMapBridgeResult
  resyncMapLayers: () => Promise<void>
}

export function useTerritoryMapResync({ map, resyncMapLayers }: UseTerritoryMapResyncOptions) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleMapReady = useCallback(() => {
    map.flushAdapterPending()
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      timerRef.current = null
      void resyncMapLayers().finally(() => {
        map.flushAdapterPending()
      })
    }, 80)
  }, [map, resyncMapLayers])

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])

  return handleMapReady
}

interface UseTerritoryMapDrillSyncOptions {
  map: Pick<UseGeoinsightMapBridgeResult, 'syncDrillContext'>
  level: TerritoryLevel
  breadcrumb: BreadcrumbCrumb[]
}

export function useTerritoryMapDrillSync({ map, level, breadcrumb }: UseTerritoryMapDrillSyncOptions) {
  useEffect(() => {
    const excludeAreaIds =
      level === LEVEL_SUB_AREAS
        ? breadcrumb.filter((crumb) => crumb.level === LEVEL_SUB_AREAS).map((crumb) => crumb.id)
        : []
    map.syncDrillContext(excludeAreaIds)
  }, [map, level, breadcrumb])
}

interface UseTerritoryMapFeatureSelectOptions {
  map: Pick<UseGeoinsightMapBridgeResult, 'setOnFeatureSelect'>
  handleFeatureSelect: (
    id: number,
    label: string,
    feature?: unknown,
    layerKind?: 'territory' | 'green_area' | 'green_asset' | 'cluster'
  ) => void
}

export function useTerritoryMapFeatureSelect({
  map,
  handleFeatureSelect,
}: UseTerritoryMapFeatureSelectOptions) {
  useEffect(() => {
    map.setOnFeatureSelect(handleFeatureSelect)
  }, [map, handleFeatureSelect])
}

interface UseTerritoryMapLeafCleanupOptions {
  breadcrumb: BreadcrumbCrumb[]
  clearStoredLeafArea?: () => void
}

export function useTerritoryMapLeafCleanup({
  breadcrumb,
  clearStoredLeafArea,
}: UseTerritoryMapLeafCleanupOptions) {
  useEffect(() => {
    const last = breadcrumb[breadcrumb.length - 1]
    if (last?.level !== LEVEL_GREEN_AREAS && last?.level !== LEVEL_SUB_AREAS) {
      clearStoredLeafArea?.()
    }
  }, [breadcrumb, clearStoredLeafArea])
}
