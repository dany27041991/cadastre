/**
 * Territory map widget: Geoinsight map + navigation + green palette.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Box } from 'dxc-webkit'
import {
  territoryApi,
  useTerritoryNavigation,
  LEVEL_GREEN_AREAS,
  LEVEL_SUB_AREAS,
} from '@/features/territory'
import { useGreenAssetsLayer } from '@/features/territory/model/hooks/useGreenAssetsLayer'
import {
  buildGreenAreasTableQuery,
  buildGreenAssetsTableQuery,
} from '@/features/territory/lib/greenTableParams'
import { filterGreenAreaChildren } from '@/features/territory/lib/greenAreaDrill'
import { useGreenTablePanel } from '@/features/territory/context/GreenTablePanelContext'
import { MainContent } from '@/widgets/layout/main/MainContent'
import {
  GeoinsightFocusContainer,
  GeoinsightMapContainer,
  useGeoinsightMapBridge,
} from '@/features/territory-map-geoinsight'
import { useTerritoryMapBridge } from './useTerritoryMapBridge'
import {
  useTerritoryMapDrillSync,
  useTerritoryMapFeatureSelect,
  useTerritoryMapLeafCleanup,
  useTerritoryMapResync,
} from './useTerritoryMapEffects'

export function TerritoryMapWidget() {
  const { t } = useTranslation()
  const map = useGeoinsightMapBridge()
  const mapBridge = useTerritoryMapBridge(map)
  const [greenAssetsLayerActive, setGreenAssetsLayerActive] = useState(false)
  const greenAssetsLayerActiveRef = useRef(greenAssetsLayerActive)
  greenAssetsLayerActiveRef.current = greenAssetsLayerActive
  const nav = useTerritoryNavigation(mapBridge, {
    api: territoryApi,
    t,
    isAssetsLayerActive: () => greenAssetsLayerActiveRef.current,
  })

  useTerritoryMapFeatureSelect({ map, handleFeatureSelect: nav.handleFeatureSelect })
  useTerritoryMapDrillSync({ map, level: nav.level, breadcrumb: nav.breadcrumb })
  useTerritoryMapLeafCleanup({
    breadcrumb: nav.breadcrumb,
    clearStoredLeafArea: mapBridge.clearStoredLeafArea,
  })

  const handleMapReady = useTerritoryMapResync({ map, resyncMapLayers: nav.resyncMapLayers })

  const areasTableQuery = useMemo(
    () => buildGreenAreasTableQuery(nav.level, nav.breadcrumb),
    [nav.level, nav.breadcrumb]
  )
  const assetsTableQuery = useMemo(
    () => buildGreenAssetsTableQuery(nav.breadcrumb),
    [nav.breadcrumb]
  )

  const { registerGreenAssetsLayer } = useGreenTablePanel()

  const restoreGreenAreas = useCallback(async (options?: { skipFit?: boolean }) => {
    const skipFit = options?.skipFit
    const last = nav.breadcrumb[nav.breadcrumb.length - 1]
    if (!last?.regionId || (last.level !== LEVEL_GREEN_AREAS && last.level !== LEVEL_SUB_AREAS)) {
      map.clearGreenLayer()
      mapBridge.clearStoredLeafArea?.()
      return
    }
    if (!last.provinceId) return
    const storedLeaf =
      last.level === LEVEL_SUB_AREAS ? mapBridge.getStoredLeafArea?.(last.id) ?? null : null
    const geojson =
      last.level === LEVEL_GREEN_AREAS
        ? await territoryApi.getGreenAreas({
            regionId: last.regionId,
            provinceId: last.provinceId,
            municipalityId: last.id,
            subMunicipalAreaId: last.subMunicipalAreaId,
          })
        : await territoryApi.getGreenAreas({
            regionId: last.regionId,
            provinceId: last.provinceId,
            municipalityId:
              last.municipalityId ??
              nav.breadcrumb.find((c) => c.level === 'green_areas')?.id,
            containedInAreaId: last.id,
          })
    const isValidGeoJson =
      geojson != null && (geojson as { type?: string }).type === 'FeatureCollection'
    const hasFeatures = Boolean(isValidGeoJson && geojson.features?.length)
    if (last.level === LEVEL_SUB_AREAS) {
      if (isValidGeoJson) {
        const childrenGeojson = filterGreenAreaChildren(geojson, last.id)
        if (childrenGeojson.features?.length) {
          map.setTerritoryFillVisible(false)
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
      map.setTerritoryFillVisible(false)
      map.loadGreenLayer(geojson, { skipFit })
    } else {
      map.clearGreenLayer()
    }
    map.setGreenLayerVisible(true)
  }, [nav.breadcrumb, map, mapBridge])

  const onBeforeLoadingAssets = useCallback(() => {
    const features = map.getGreenLayerFeatures()
    if (features.length === 1) {
      mapBridge.storeLeafAreaForRestore?.(features[0].id, features[0])
      return
    }
    const last = nav.breadcrumb[nav.breadcrumb.length - 1]
    if (last?.level === LEVEL_SUB_AREAS && mapBridge.getStoredLeafArea?.(last.id)) {
      return
    }
    mapBridge.clearStoredLeafArea?.()
  }, [map, mapBridge, nav.breadcrumb])

  const greenAssetsLayer = useGreenAssetsLayer({
    breadcrumb: nav.breadcrumb,
    level: nav.level,
    loadGreenLayerViewport: map.loadGreenLayerViewport,
    setGreenLayerVisible: map.setGreenLayerVisible,
    clearGreenLayer: map.clearGreenLayer,
    restoreGreenAreas,
    fitToGreenExtent: map.fitToGreenExtent,
    setTerritoryFillVisible: map.setTerritoryFillVisible,
    onBeforeLoadingAssets,
    assetsLayerActive: greenAssetsLayerActive,
    onAssetsLayerActiveChange: setGreenAssetsLayerActive,
  })

  const setActiveRef = useRef(greenAssetsLayer.setActive)
  setActiveRef.current = greenAssetsLayer.setActive

  const stableSetActive = useCallback((active: boolean) => {
    void setActiveRef.current(active)
  }, [])

  useEffect(() => {
    registerGreenAssetsLayer({
      active: greenAssetsLayerActive,
      loading: greenAssetsLayer.loading,
      available: greenAssetsLayer.available,
      setActive: stableSetActive,
    })
    return () => registerGreenAssetsLayer(null)
  }, [
    greenAssetsLayerActive,
    greenAssetsLayer.loading,
    greenAssetsLayer.available,
    stableSetActive,
    registerGreenAssetsLayer,
  ])

  const mapOverlay = (
    <GeoinsightFocusContainer>
      <GeoinsightMapContainer
        onFeatureInfo={map.handleFeatureInfo}
        onDrawnGeometryInfo={map.handleDrawnGeometryInfo}
        onReady={handleMapReady}
      />
    </GeoinsightFocusContainer>
  )

  return (
    <Box as="div" display="flex" flexDirection="column" style={{ height: '100%' }}>
      <MainContent
        mapOverlay={mapOverlay}
        level={nav.level}
        breadcrumb={nav.breadcrumb}
        onLoadRegions={nav.loadRegions}
        onNavigateTo={nav.navigateTo}
        showGreenTableAccordion
        greenAssetsLayerActive={greenAssetsLayerActive}
        areasTableQuery={areasTableQuery}
        assetsTableQuery={assetsTableQuery}
        greenAssetsLayerLoading={greenAssetsLayer.loading}
      />
    </Box>
  )
}
