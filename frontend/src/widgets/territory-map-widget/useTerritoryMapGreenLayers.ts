/**
 * Green areas/assets layer toggles, restore, and panel registration.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import {
  territoryApi,
  LEVEL_GREEN_AREAS,
  LEVEL_SUB_AREAS,
} from '@/features/territory'
import { useGreenAssetsLayer } from '@/features/territory/model/hooks/useGreenAssetsLayer'
import { filterGreenAreaChildren } from '@/features/territory/lib/greenAreaDrill'
import type { MapBridge } from '@/features/territory/types/navigation'
import type { BreadcrumbCrumb, TerritoryLevel } from '@/features/territory/types'
import type { UseGeoinsightMapBridgeResult } from '@/features/territory-map-geoinsight'

/** Toggle state + refs for nav `is*LayerActive` (must run before navigation). */
export function useTerritoryMapGreenLayerToggles() {
  const [greenAssetsLayerActive, setGreenAssetsLayerActive] = useState(false)
  /** Default off: both layer toggles start disabled. */
  const [greenAreasLayerActive, setGreenAreasLayerActive] = useState(false)
  const greenAssetsLayerActiveRef = useRef(greenAssetsLayerActive)
  greenAssetsLayerActiveRef.current = greenAssetsLayerActive
  const greenAreasLayerActiveRef = useRef(greenAreasLayerActive)
  greenAreasLayerActiveRef.current = greenAreasLayerActive

  const deactivateLayerToggles = useCallback(() => {
    // Sync refs before React re-render so layer effects cannot restart areas-only.
    greenAreasLayerActiveRef.current = false
    greenAssetsLayerActiveRef.current = false
    setGreenAreasLayerActive(false)
    setGreenAssetsLayerActive(false)
  }, [])

  return {
    greenAssetsLayerActive,
    setGreenAssetsLayerActive,
    greenAreasLayerActive,
    setGreenAreasLayerActive,
    greenAssetsLayerActiveRef,
    greenAreasLayerActiveRef,
    deactivateLayerToggles,
  }
}

export type UseTerritoryMapGreenLayersArgs = {
  map: UseGeoinsightMapBridgeResult
  mapBridge: MapBridge
  breadcrumb: BreadcrumbCrumb[]
  level: TerritoryLevel
  dateFromIso: string
  dateToIso: string
  clipWkt: string | null
  clipRequired: boolean
  greenAssetsLayerActive: boolean
  setGreenAssetsLayerActive: (active: boolean) => void
  greenAreasLayerActive: boolean
  setGreenAreasLayerActive: (active: boolean) => void
  registerGreenAssetsLayer: (
    layer: {
      active: boolean
      areasActive: boolean
      loading: boolean
      available: boolean
      setActive: (active: boolean) => void | Promise<void>
      setAreasActive: (active: boolean) => void | Promise<void>
    } | null,
  ) => void
}

export function useTerritoryMapGreenLayers({
  map,
  mapBridge,
  breadcrumb,
  level,
  dateFromIso,
  dateToIso,
  clipWkt,
  clipRequired,
  greenAssetsLayerActive,
  setGreenAssetsLayerActive,
  greenAreasLayerActive,
  setGreenAreasLayerActive,
  registerGreenAssetsLayer,
}: UseTerritoryMapGreenLayersArgs) {
  const restoreGreenAreas = useCallback(
    async (options?: { skipFit?: boolean }) => {
      const skipFit = options?.skipFit
      const last = breadcrumb[breadcrumb.length - 1]
      if (
        !last?.regionId ||
        (last.level !== LEVEL_GREEN_AREAS && last.level !== LEVEL_SUB_AREAS)
      ) {
        map.clearGreenLayer()
        mapBridge.clearStoredLeafArea?.()
        return
      }
      if (!last.provinceId) return
      const storedLeaf =
        last.level === LEVEL_SUB_AREAS
          ? mapBridge.getStoredLeafArea?.(last.id) ?? null
          : null
      const geojson =
        last.level === LEVEL_GREEN_AREAS
          ? await territoryApi.getGreenAreas({
              regionId: last.regionId,
              provinceId: last.provinceId,
              municipalityId: last.id,
              subMunicipalAreaId: last.subMunicipalAreaId,
              dateFrom: dateFromIso || undefined,
              dateTo: dateToIso || undefined,
            })
          : await territoryApi.getGreenAreas({
              regionId: last.regionId,
              provinceId: last.provinceId,
              municipalityId:
                last.municipalityId ??
                breadcrumb.find((c) => c.level === 'green_areas')?.id,
              containedInAreaId: last.id,
              dateFrom: dateFromIso || undefined,
              dateTo: dateToIso || undefined,
            })
      const isValidGeoJson =
        geojson != null && (geojson as { type?: string }).type === 'FeatureCollection'
      const hasFeatures = Boolean(isValidGeoJson && geojson.features?.length)
      if (last.level === LEVEL_SUB_AREAS) {
        if (isValidGeoJson) {
          const childrenGeojson = filterGreenAreaChildren(geojson, last.id)
          if (childrenGeojson.features?.length) {
            map.loadGreenLayer(childrenGeojson, { skipFit })
          } else if (storedLeaf) {
            map.loadGreenLayerFromFeature(storedLeaf, { skipFit })
          } else {
            map.clearGreenLayer()
          }
        } else if (storedLeaf) {
          map.loadGreenLayerFromFeature(storedLeaf, { skipFit })
        } else {
          map.clearGreenLayer()
        }
      } else if (isValidGeoJson && hasFeatures) {
        map.loadGreenLayer(geojson, { skipFit })
      } else {
        map.clearGreenLayer()
      }
      map.setGreenLayerVisible(true)
    },
    [breadcrumb, map, mapBridge, dateFromIso, dateToIso],
  )

  const onBeforeLoadingAssets = useCallback(() => {
    const features = map.getGreenLayerFeatures()
    if (features.length === 1) {
      mapBridge.storeLeafAreaForRestore?.(features[0].id, features[0])
      return
    }
    const last = breadcrumb[breadcrumb.length - 1]
    if (last?.level === LEVEL_SUB_AREAS && mapBridge.getStoredLeafArea?.(last.id)) {
      return
    }
    mapBridge.clearStoredLeafArea?.()
  }, [map, mapBridge, breadcrumb])

  const greenAssetsLayer = useGreenAssetsLayer({
    breadcrumb,
    level,
    loadGreenLayerViewport: map.loadGreenLayerViewport,
    setGreenLayerVisible: map.setGreenLayerVisible,
    clearGreenLayer: map.clearGreenLayer,
    restoreGreenAreas,
    fitToGreenExtent: map.fitToGreenExtent,
    setTerritoryFillVisible: map.setTerritoryFillVisible,
    onBeforeLoadingAssets,
    assetsLayerActive: greenAssetsLayerActive,
    onAssetsLayerActiveChange: setGreenAssetsLayerActive,
    areasLayerActive: greenAreasLayerActive,
    onAreasLayerActiveChange: setGreenAreasLayerActive,
    clipWkt,
    clipRequired,
    dateFrom: dateFromIso,
    dateTo: dateToIso,
  })

  const setAssetsActiveRef = useRef(greenAssetsLayer.setAssetsActive)
  setAssetsActiveRef.current = greenAssetsLayer.setAssetsActive
  const setAreasActiveRef = useRef(greenAssetsLayer.setAreasActive)
  setAreasActiveRef.current = greenAssetsLayer.setAreasActive

  const stableSetAssetsActive = useCallback((active: boolean) => {
    void setAssetsActiveRef.current(active)
  }, [])
  const stableSetAreasActive = useCallback((active: boolean) => {
    void setAreasActiveRef.current(active)
  }, [])

  useEffect(() => {
    registerGreenAssetsLayer({
      active: greenAssetsLayerActive,
      areasActive: greenAreasLayerActive,
      loading: greenAssetsLayer.loading,
      available: greenAssetsLayer.available,
      setActive: stableSetAssetsActive,
      setAreasActive: stableSetAreasActive,
    })
    return () => registerGreenAssetsLayer(null)
  }, [
    greenAssetsLayerActive,
    greenAreasLayerActive,
    greenAssetsLayer.loading,
    greenAssetsLayer.available,
    stableSetAssetsActive,
    stableSetAreasActive,
    registerGreenAssetsLayer,
  ])

  return { greenAssetsLayer }
}
