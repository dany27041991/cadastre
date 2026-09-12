/**
 * Territory map widget: Geoinsight map + navigation + green palette.
 * Orchestrates bridge, effects, and feature hooks — no domain logic inline.
 */
import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { Box } from 'dxc-webkit'
import { territoryApi, useTerritoryNavigation } from '@/features/territory'
import { useGreenTablePanel } from '@/features/territory/context/GreenTablePanelContext'
import { MainContent } from '@/widgets/layout/main/MainContent'
import { useGeoinsightMapBridge } from '@/features/territory-map-geoinsight'
import { useTerritoryMapBridge } from './useTerritoryMapBridge'
import {
  useTerritoryMapDrillSync,
  useTerritoryMapFeatureSelect,
  useTerritoryMapLeafCleanup,
  useTerritoryMapResync,
} from './useTerritoryMapEffects'
import { TerritoryMapOverlay } from './TerritoryMapOverlay'
import { useTerritoryMapGreenDetail } from './useTerritoryMapGreenDetail'
import {
  useTerritoryMapGreenLayerToggles,
  useTerritoryMapGreenLayers,
} from './useTerritoryMapGreenLayers'
import { useTerritoryMapDrawClip } from './useTerritoryMapDrawClip'
import { useTerritoryMapPanelMode } from './useTerritoryMapPanelMode'

export function TerritoryMapWidget() {
  const { t } = useTranslation()
  const map = useGeoinsightMapBridge()
  const mapBridge = useTerritoryMapBridge(map)
  const {
    registerGreenAssetsLayer,
    registerResetToLanding,
    registerTerritorySearchNav,
    resetPanelState,
    layersPanelOpen,
    entryMode,
    spatialClip,
    setSpatialClip,
    setMapTableAccordionVisible,
    dateFromIso,
    dateToIso,
  } = useGreenTablePanel()

  const {
    greenAssetsLayerActive,
    setGreenAssetsLayerActive,
    greenAreasLayerActive,
    setGreenAreasLayerActive,
    greenAssetsLayerActiveRef,
    greenAreasLayerActiveRef,
    deactivateLayerToggles,
  } = useTerritoryMapGreenLayerToggles()

  const nav = useTerritoryNavigation(mapBridge, {
    api: territoryApi,
    t,
    isAssetsLayerActive: () => greenAssetsLayerActiveRef.current,
    isAreasLayerActive: () => greenAreasLayerActiveRef.current,
    dateFromIso,
    dateToIso,
  })

  useTerritoryMapFeatureSelect({ map, handleFeatureSelect: nav.handleFeatureSelect })
  useTerritoryMapDrillSync({ map, level: nav.level, breadcrumb: nav.breadcrumb })
  useTerritoryMapLeafCleanup({
    breadcrumb: nav.breadcrumb,
    clearStoredLeafArea: mapBridge.clearStoredLeafArea,
  })

  const {
    greenDetail,
    handleMapPointerDown,
    handleDrillFromModal,
    handleOpenGreenDetailFromTable,
    openGreenAreaDetailFromSearch,
  } = useTerritoryMapGreenDetail({
    map,
    breadcrumb: nav.breadcrumb,
    dateFromIso,
    dateToIso,
    setMapTableAccordionVisible,
    drillGreenArea: nav.drillGreenArea,
  })

  const { layersPanelOpenRef, clipWkt, areasTableQuery, assetsTableQuery } =
    useTerritoryMapPanelMode({
      map,
      entryMode,
      spatialClip,
      layersPanelOpen,
      greenAssetsLayerActive,
      greenAreasLayerActive,
      level: nav.level,
      breadcrumb: nav.breadcrumb,
      dateFromIso,
      dateToIso,
      loadRegions: nav.loadRegions,
      jumpToSearchHit: nav.jumpToSearchHit,
      navLoading: nav.loading,
      openGreenAreaDetail: openGreenAreaDetailFromSearch,
      closeGreenDetail: greenDetail.close,
      deactivateLayerToggles,
      resetPanelState,
      registerResetToLanding,
      registerTerritorySearchNav,
    })

  const { greenAssetsLayer } = useTerritoryMapGreenLayers({
    map,
    mapBridge,
    breadcrumb: nav.breadcrumb,
    level: nav.level,
    dateFromIso,
    dateToIso,
    clipWkt,
    clipRequired: entryMode === 'draw',
    greenAssetsLayerActive,
    setGreenAssetsLayerActive,
    greenAreasLayerActive,
    setGreenAreasLayerActive,
    registerGreenAssetsLayer,
  })

  const resyncMapForReady = useCallback(async () => {
    if (!layersPanelOpenRef.current) {
      map.clearTerritoryLayer()
      return
    }
    await nav.resyncMapLayers()
  }, [map, nav.resyncMapLayers, layersPanelOpenRef])

  const handleMapReady = useTerritoryMapResync({ map, resyncMapLayers: resyncMapForReady })

  const { handleGeometryDrawn, handleSimpleFeatureDrawn } = useTerritoryMapDrawClip({
    map,
    entryMode,
    spatialClip,
    setSpatialClip,
  })

  const mapOverlay = (
    <TerritoryMapOverlay
      map={map}
      greenDetail={greenDetail}
      onGeometryDrawn={handleGeometryDrawn}
      onSimpleFeatureDrawn={handleSimpleFeatureDrawn}
      onReady={handleMapReady}
      onMapPointerDown={handleMapPointerDown}
      onDrillFromModal={handleDrillFromModal}
    />
  )

  return (
    <Box as="div" display="flex" flexDirection="column" style={{ height: '100%' }}>
      <MainContent
        mapOverlay={mapOverlay}
        level={nav.level}
        breadcrumb={nav.breadcrumb}
        onLoadRegions={nav.loadRegions}
        onNavigateTo={nav.navigateTo}
        showGreenTableAccordion={
          layersPanelOpen && (greenAreasLayerActive || greenAssetsLayerActive)
        }
        greenAreasLayerActive={greenAreasLayerActive}
        greenAssetsLayerActive={greenAssetsLayerActive}
        areasTableQuery={areasTableQuery}
        assetsTableQuery={assetsTableQuery}
        greenAssetsLayerLoading={greenAssetsLayer.loading}
        onOpenGreenDetail={handleOpenGreenDetailFromTable}
      />
    </Box>
  )
}
