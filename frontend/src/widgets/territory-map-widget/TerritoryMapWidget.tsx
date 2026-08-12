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
import { useGreenFeatureDetail } from '@/features/territory/model/hooks/useGreenFeatureDetail'
import { GreenDetailModal } from '@/features/territory/ui/green-detail/GreenDetailModal'
import { resolveGreenDetailAnchorLonLat, bboxFromMapFeature } from '@/features/territory/lib/greenDetailMapAnchor'
import { resolveGreenFeatureFromTableRow } from '@/features/territory/lib/greenTableRowToMapFeature'
import {
  buildGreenAreasTableQuery,
  buildGreenAssetsTableQuery,
} from '@/features/territory/lib/greenTableParams'
import { filterGreenAreaChildren } from '@/features/territory/lib/greenAreaDrill'
import {
  LAYER_KIND_GREEN_AREA,
  LAYER_KIND_GREEN_ASSET,
  GREEN_DETAIL_STATUS_READY,
} from '@/features/territory/model/constants'
import type { TerritoryMapFeature } from '@/features/territory/types/mapFeature'
import type { GreenTableRawRow } from '@/features/territory/ui/green-data-table/GreenTableRowActions'
import { useGreenTablePanel } from '@/features/territory/context/GreenTablePanelContext'
import { MainContent } from '@/widgets/layout/main/MainContent'
import { useGreenTablePanelOptional } from '@/features/territory/context/GreenTablePanelContext'
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
  /** Default off: both layer toggles start disabled. */
  const [greenAreasLayerActive, setGreenAreasLayerActive] = useState(false)
  const greenAssetsLayerActiveRef = useRef(greenAssetsLayerActive)
  greenAssetsLayerActiveRef.current = greenAssetsLayerActive
  const greenAreasLayerActiveRef = useRef(greenAreasLayerActive)
  greenAreasLayerActiveRef.current = greenAreasLayerActive
  const nav = useTerritoryNavigation(mapBridge, {
    api: territoryApi,
    t,
    isAssetsLayerActive: () => greenAssetsLayerActiveRef.current,
    isAreasLayerActive: () => greenAreasLayerActiveRef.current,
  })

  useTerritoryMapFeatureSelect({ map, handleFeatureSelect: nav.handleFeatureSelect })
  useTerritoryMapDrillSync({ map, level: nav.level, breadcrumb: nav.breadcrumb })
  useTerritoryMapLeafCleanup({
    breadcrumb: nav.breadcrumb,
    clearStoredLeafArea: mapBridge.clearStoredLeafArea,
  })

  useEffect(() => {
    // Freeze admin territory click when green overlays are on (no jump).
    // Green area/asset clicks always open the detail modal via adapter.
    map.setClickNavigationEnabled(!(greenAssetsLayerActive || greenAreasLayerActive))
  }, [map, greenAssetsLayerActive, greenAreasLayerActive])

  const layersPanelOpenRef = useRef(false)

  const resyncMapForReady = useCallback(async () => {
    if (!layersPanelOpenRef.current) {
      map.clearTerritoryLayer()
      return
    }
    await nav.resyncMapLayers()
  }, [map, nav.resyncMapLayers])

  const handleMapReady = useTerritoryMapResync({ map, resyncMapLayers: resyncMapForReady })

  const greenDetail = useGreenFeatureDetail({ breadcrumb: nav.breadcrumb })
  const greenTablePanel = useGreenTablePanelOptional()
  const lastMapPointerRef = useRef<{ clientX: number; clientY: number } | null>(null)
  /** Table row had no map geometry — frame once detail bbox arrives. */
  const pendingTableFrameRef = useRef(false)

  // Collapse green data accordion while the detail panel is open.
  useEffect(() => {
    if (!greenDetail.isOpen) return
    greenTablePanel?.setMapTableAccordionVisible(false)
  }, [greenDetail.isOpen, greenTablePanel])

  // Red selection: recolor mounted GA_/GS_ while detail is open (no GH_ overlay labels).
  useEffect(() => {
    if (!greenDetail.isOpen || !greenDetail.selection) {
      map.clearGreenDetailHighlight()
      return
    }
    const preferAsset = greenDetail.selection.kind === 'asset'
    const feature = {
      ...greenDetail.selection.feature,
      properties: {
        ...greenDetail.selection.feature.properties,
        __greenKind: greenDetail.selection.kind,
      },
    }
    map.setGreenDetailHighlight(feature, { preferAsset })
  }, [
    map,
    greenDetail.isOpen,
    greenDetail.selection?.id,
    greenDetail.selection?.kind,
    greenDetail.selection?.anchorLon,
    greenDetail.selection?.anchorLat,
    // Re-apply when true geometry arrives from detail API (replaces empty/bbox placeholder).
    (greenDetail.selection?.feature.geometry as { type?: string } | undefined)?.type,
  ])

  // Unmount-only cleanup (avoid StrictMode clear/set thrash removing the red flash).
  useEffect(() => {
    return () => {
      map.clearGreenDetailHighlight()
    }
  }, [map])

  const placeDetailPanelAtMapFraction = useCallback((): {
    clientX: number
    clientY: number
  } | null => {
    const mapEl =
      typeof document !== 'undefined'
        ? document.querySelector('.ol-viewport') ??
          document.querySelector('[aria-label="Map view"]')
        : null
    if (!mapEl) return null
    const rect = mapEl.getBoundingClientRect()
    if (rect.width <= 0 || rect.height <= 0) return null
    const clientX = Math.round(rect.left + rect.width * 0.5)
    const clientY = Math.round(rect.top + rect.height * 0.2)
    greenDetail.updateAnchorScreen(clientX, clientY)
    return { clientX, clientY }
  }, [greenDetail.updateAnchorScreen])

  const frameGreenDetailOnMap = useCallback(
    (
      feature: TerritoryMapFeature,
      lon: number,
      lat: number,
      options?: { forceMaxZoom?: boolean },
    ) => {
      const bbox = bboxFromMapFeature(feature)
      map.zoomToLonLatAtScreenFraction(lon, lat, {
        bbox,
        forceMaxZoom: options?.forceMaxZoom,
      })
      placeDetailPanelAtMapFraction()
    },
    [map, placeDetailPanelAtMapFraction],
  )

  useEffect(() => {
    map.setOnGreenDetailSelect((id, label, feature, layerKind) => {
      const pointer = lastMapPointerRef.current
      const anchor = resolveGreenDetailAnchorLonLat(feature, pointer)
      if (anchor) {
        frameGreenDetailOnMap(feature, anchor.lon, anchor.lat, {
          forceMaxZoom: layerKind === LAYER_KIND_GREEN_ASSET,
        })
      }
      greenDetail.openFromSelection(id, label, feature, layerKind, pointer)
      if (anchor) placeDetailPanelAtMapFraction()
    })
  }, [
    map,
    greenDetail.openFromSelection,
    frameGreenDetailOnMap,
    placeDetailPanelAtMapFraction,
  ])

  const handleMapPointerDown = useCallback(
    (pointer: { clientX: number; clientY: number }) => {
      lastMapPointerRef.current = pointer
    },
    []
  )

  const handleDrillFromModal = useCallback(() => {
    const sel = greenDetail.selection
    if (!sel || sel.kind !== 'area') return
    greenDetail.close()
    nav.drillGreenArea(sel.id, sel.primaryLabel, sel.feature)
  }, [greenDetail, nav, greenAssetsLayerActive, greenAreasLayerActive])

  const handleOpenGreenDetailFromTable = useCallback(
    (row: GreenTableRawRow, kind: 'area' | 'asset') => {
      const mounted = map.getGreenLayerFeatures()
      const resolved = resolveGreenFeatureFromTableRow(row, kind, mounted)
      if (!resolved) return
      const layerKind =
        kind === 'asset' ? LAYER_KIND_GREEN_ASSET : LAYER_KIND_GREEN_AREA
      const anchor = resolveGreenDetailAnchorLonLat(resolved.feature, null)
      if (anchor) {
        frameGreenDetailOnMap(resolved.feature, anchor.lon, anchor.lat, {
          forceMaxZoom: kind === 'asset',
        })
      } else {
        pendingTableFrameRef.current = true
      }
      // Screen-anchor first (map 50%/20%) so the panel never opens at window-center / (0,0).
      const screenPointer = placeDetailPanelAtMapFraction()
      greenDetail.openFromSelection(
        resolved.id,
        resolved.label,
        resolved.feature,
        layerKind,
        screenPointer,
      )
    },
    [
      map,
      greenDetail.openFromSelection,
      frameGreenDetailOnMap,
      placeDetailPanelAtMapFraction,
    ],
  )

  // Table→detail: zoom when API bbox arrives (no mounted map geometry).
  useEffect(() => {
    if (!pendingTableFrameRef.current) return
    if (greenDetail.status !== GREEN_DETAIL_STATUS_READY) return
    const bbox = greenDetail.detail?.bbox
    if (!bbox || bbox.length !== 4) {
      pendingTableFrameRef.current = false
      return
    }
    pendingTableFrameRef.current = false
    const lon = (bbox[0] + bbox[2]) / 2
    const lat = (bbox[1] + bbox[3]) / 2
    const forceMaxZoom =
      greenDetail.selection?.kind === 'asset' || greenDetail.detail?.kind === 'asset'
    map.zoomToLonLatAtScreenFraction(lon, lat, { bbox, forceMaxZoom })
    placeDetailPanelAtMapFraction()
  }, [
    greenDetail.status,
    greenDetail.detail,
    greenDetail.selection?.kind,
    map,
    placeDetailPanelAtMapFraction,
  ])

  const areasTableQuery = useMemo(
    () => buildGreenAreasTableQuery(nav.level, nav.breadcrumb),
    [nav.level, nav.breadcrumb]
  )
  const assetsTableQuery = useMemo(
    () => buildGreenAssetsTableQuery(nav.breadcrumb),
    [nav.breadcrumb]
  )

  const { registerGreenAssetsLayer, registerResetToLanding, resetPanelState, layersPanelOpen } =
    useGreenTablePanel()

  layersPanelOpenRef.current = layersPanelOpen

  const loadRegionsRef = useRef(nav.loadRegions)
  loadRegionsRef.current = nav.loadRegions
  const mapRef = useRef(map)
  mapRef.current = map
  const prevLayersPanelOpenRef = useRef(layersPanelOpen)

  // Monitoraggio → hide admin territories. Area Italia (layers) → load Italy once on enter.
  useEffect(() => {
    const open = layersPanelOpen
    const wasOpen = prevLayersPanelOpenRef.current
    prevLayersPanelOpenRef.current = open
    if (!open) {
      mapRef.current.clearTerritoryLayer()
      return
    }
    if (!wasOpen) {
      void loadRegionsRef.current({ fit: false })
    }
  }, [layersPanelOpen])

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
    areasLayerActive: greenAreasLayerActive,
    onAreasLayerActiveChange: setGreenAreasLayerActive,
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

  const closeGreenDetailRef = useRef(greenDetail.close)
  closeGreenDetailRef.current = greenDetail.close

  const resetToLanding = useCallback(() => {
    // Sync refs before React re-render so layer effects cannot restart areas-only.
    greenAreasLayerActiveRef.current = false
    greenAssetsLayerActiveRef.current = false
    setGreenAreasLayerActive(false)
    setGreenAssetsLayerActive(false)
    closeGreenDetailRef.current()
    // Discard (do not restore/re-add) so red selection vanishes with the green layer.
    map.discardGreenDetailHighlight()
    map.clearGreenLayer()
    map.setGreenLayerVisible(false)
    resetPanelState()
    layersPanelOpenRef.current = false
    // Reset breadcrumb/level to Italy, then hide admin polygons (Monitoraggio).
    void loadRegionsRef.current().then(() => {
      map.clearTerritoryLayer()
    })
  }, [map, resetPanelState])

  useEffect(() => {
    registerResetToLanding(resetToLanding)
    return () => registerResetToLanding(null)
  }, [registerResetToLanding, resetToLanding])

  const mapOverlay = (
    <GeoinsightFocusContainer>
      <GeoinsightMapContainer
        onFeatureInfo={map.handleFeatureInfo}
        onDrawnGeometryInfo={map.handleDrawnGeometryInfo}
        onReady={handleMapReady}
        onMapPointerDown={handleMapPointerDown}
      />
      <GreenDetailModal
        isOpen={greenDetail.isOpen}
        status={greenDetail.status}
        selection={greenDetail.selection}
        detail={greenDetail.detail}
        errorNotFound={greenDetail.errorNotFound}
        onClose={greenDetail.close}
        onDrill={handleDrillFromModal}
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
