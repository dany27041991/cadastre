/**
 * Territory navigation hook: state (level, breadcrumb), API fetch, map bridge.
 * Orchestrates smaller modules — no business logic duplication here.
 */
import { useState, useCallback, useRef, useMemo } from 'react'
import { createLevelFetchers } from '../fetchers/mapNavigationFetchers'
import { loadGreenSubAreas } from '../../lib/loadGreenSubAreas'
import { restoreMapForBreadcrumb } from '../../lib/restoreMapForBreadcrumb'
import { getRegionIdFromMapFeature } from '../../lib/featureIdentity'
import { jumpToTerritorySearchHit } from '../../lib/jumpToTerritorySearchHit'
import type { TerritorySearchHit } from '../../types/territorySearch'
import type {
  TerritoryLevel,
  BreadcrumbCrumb,
  MapBridge,
  UseTerritoryNavigationResult,
  UseTerritoryNavigationOptions,
} from '../../types'
import {
  I18N_KEYS,
  LABEL_GREEN_AREAS,
  LEVEL_GREEN_AREAS,
  LEVEL_MUNICIPALITIES,
  LEVEL_PROVINCES,
  LEVEL_REGIONS,
  LEVEL_SUB_AREAS,
  LEVEL_SUB_MUNICIPAL_AREAS,
  LAYER_KIND_GREEN_AREA,
  LAYER_KIND_GREEN_ASSET,
  SUFFIX_PROVINCE,
  type MapLayerKind,
} from '../constants'
import { useGreenLayerDisplay } from './useGreenLayerDisplay'
import { useAdminTerritoryLoaders } from './useAdminTerritoryLoaders'

export type { MapBridge, UseTerritoryNavigationResult, UseTerritoryNavigationOptions } from '../../types'

export function useTerritoryNavigation(
  mapBridge: MapBridge,
  options: UseTerritoryNavigationOptions
): UseTerritoryNavigationResult {
  const api = options.api
  const t = options.t
  const isAssetsLayerActive = options.isAssetsLayerActive
  const isAreasLayerActive = options.isAreasLayerActive
  const labelGreenAreas = t ? t(I18N_KEYS.greenAreas) : LABEL_GREEN_AREAS
  const suffixProvince = t ? t(I18N_KEYS.provinceSuffix) : SUFFIX_PROVINCE
  const [level, setLevel] = useState<TerritoryLevel>(LEVEL_REGIONS)
  const [breadcrumb, setBreadcrumb] = useState<BreadcrumbCrumb[]>([])
  const [loading, setLoading] = useState(false)
  const bridgeRef = useRef(mapBridge)
  bridgeRef.current = mapBridge
  const navigateInProgressRef = useRef(false)
  const assetsActiveRef = useRef(isAssetsLayerActive)
  assetsActiveRef.current = isAssetsLayerActive
  const areasActiveRef = useRef(isAreasLayerActive)
  areasActiveRef.current = isAreasLayerActive

  const levelFetchers = useMemo(
    () => (api ? createLevelFetchers(api) : {}),
    [api]
  )

  const applyGeoJsonToBridge = useCallback(
    (geojson: Parameters<MapBridge['loadGeoJson']>[0], fit = false) => {
      bridgeRef.current.loadGeoJson(geojson)
      if (fit) bridgeRef.current.fitToCurrentExtent()
    },
    []
  )

  const withLoading = useCallback(async (fn: () => Promise<void>) => {
    setLoading(true)
    try {
      await fn()
    } finally {
      setLoading(false)
    }
  }, [])

  const clearTerritoryState = useCallback(() => {
    bridgeRef.current.clearMapVectorLayers()
    bridgeRef.current.clearStoredLeafArea?.()
  }, [])

  const { showGreenLayer, showLeafAreaFromFeature } = useGreenLayerDisplay(
    bridgeRef,
    areasActiveRef,
    assetsActiveRef
  )

  const {
    loadRegions,
    loadProvinces,
    loadMunicipalities,
    loadSubMunicipalAreas,
    loadGreenAreas,
  } = useAdminTerritoryLoaders({
    api,
    bridgeRef,
    assetsActiveRef,
    breadcrumb,
    labelGreenAreas,
    suffixProvince,
    withLoading,
    clearTerritoryState,
    applyGeoJsonToBridge,
    showGreenLayer,
    setLevel,
    setBreadcrumb,
  })

  const loadSubAreas = useCallback(
    async (
      areaId: number,
      regionId: number,
      label: string,
      clickedFeature?: unknown
    ) => {
      if (!api) return
      await withLoading(() =>
        loadGreenSubAreas({
          api,
          bridge: bridgeRef.current,
          breadcrumb,
          areaId,
          regionId,
          label,
          clickedFeature,
          labelGreenAreas,
          suffixProvince,
          assetsActive: assetsActiveRef.current?.() ?? false,
          areasActive: areasActiveRef.current?.() ?? true,
          showGreenLayer,
          showLeafAreaFromFeature,
          setLevel,
          setBreadcrumb,
        })
      )
    },
    [
      api,
      breadcrumb,
      withLoading,
      showGreenLayer,
      showLeafAreaFromFeature,
      labelGreenAreas,
      suffixProvince,
    ]
  )

  const navigateTo = useCallback(
    async (index: number) => {
      if (navigateInProgressRef.current) return
      if (index < 0) {
        await loadRegions()
        return
      }
      const newCrumb = breadcrumb.slice(0, index + 1)
      const last = newCrumb[newCrumb.length - 1]
      if (!last) return
      if (newCrumb.length === breadcrumb.length) return
      setBreadcrumb((prev) => prev.slice(0, index + 1))
      if (last.level !== LEVEL_GREEN_AREAS && last.level !== LEVEL_SUB_AREAS) {
        clearTerritoryState()
      }
      const fetcher = levelFetchers[last.level]
      if (!fetcher) return

      navigateInProgressRef.current = true
      setLevel(last.level)
      try {
        await withLoading(() =>
          restoreMapForBreadcrumb({
            api,
            bridge: bridgeRef.current,
            crumb: newCrumb,
            last,
            fetcher,
            assetsLayerActive: assetsActiveRef.current?.() ?? false,
            showGreenLayer,
            showLeafAreaFromFeature,
            applyGeoJsonToBridge,
          })
        )
      } finally {
        navigateInProgressRef.current = false
      }
    },
    [
      api,
      breadcrumb,
      loadRegions,
      levelFetchers,
      withLoading,
      applyGeoJsonToBridge,
      clearTerritoryState,
      showGreenLayer,
      showLeafAreaFromFeature,
    ]
  )

  const resyncMapLayers = useCallback(async () => {
    if (!api) return
    if ((level === LEVEL_REGIONS && breadcrumb.length === 0) || breadcrumb.length === 0) {
      await loadRegions()
      return
    }
    const last = breadcrumb[breadcrumb.length - 1]
    if (!last) {
      await loadRegions()
      return
    }
    const fetcher = levelFetchers[last.level]
    if (!fetcher) return

    await withLoading(() =>
      restoreMapForBreadcrumb({
        api,
        bridge: bridgeRef.current,
        crumb: breadcrumb,
        last,
        fetcher,
        assetsLayerActive: assetsActiveRef.current?.() ?? false,
        showGreenLayer,
        showLeafAreaFromFeature,
        applyGeoJsonToBridge,
        clearTerritoryState,
      })
    )
  }, [
    api,
    level,
    breadcrumb,
    levelFetchers,
    loadRegions,
    withLoading,
    applyGeoJsonToBridge,
    clearTerritoryState,
    showGreenLayer,
    showLeafAreaFromFeature,
  ])

  const goBack = useCallback(() => {
    navigateTo(breadcrumb.length - 2)
  }, [breadcrumb.length, navigateTo])

  const resolveRegionId = useCallback(
    (feature?: unknown) => {
      const regionIdFromFeature = feature ? getRegionIdFromMapFeature(feature) : undefined
      const regionIdFromBreadcrumb = [...breadcrumb]
        .reverse()
        .find((crumb) => crumb.regionId != null)?.regionId
      return regionIdFromFeature ?? regionIdFromBreadcrumb ?? breadcrumb[0]?.id
    },
    [breadcrumb]
  )

  const handleFeatureSelect = useCallback(
    (
      id: number,
      label: string,
      feature?: unknown,
      layerKind?: MapLayerKind
    ) => {
      if (layerKind === LAYER_KIND_GREEN_ASSET || layerKind === LAYER_KIND_GREEN_AREA) return
      const overlaysActive =
        (assetsActiveRef.current?.() ?? false) || (areasActiveRef.current?.() ?? false)
      if (overlaysActive) return

      const regionIdFromCrumb = breadcrumb[0]?.id
      const municipalityId = breadcrumb[breadcrumb.length - 1]?.id
      const loadSubAreasFromFeature = () => {
        const regionId = resolveRegionId(feature)
        if (regionId != null) loadSubAreas(id, regionId, label, feature)
      }
      const actions: Partial<Record<TerritoryLevel, () => void>> = {
        [LEVEL_REGIONS]: () => {
          loadProvinces(id, label)
        },
        [LEVEL_PROVINCES]: () => {
          loadMunicipalities(id, label)
        },
        [LEVEL_MUNICIPALITIES]: () => {
          const provinceId = breadcrumb[1]?.id
          loadSubMunicipalAreas(regionIdFromCrumb ?? 0, id, label, feature, provinceId)
        },
        [LEVEL_SUB_MUNICIPAL_AREAS]: () => {
          if (regionIdFromCrumb != null && municipalityId != null && feature)
            loadGreenAreas(regionIdFromCrumb, municipalityId, label, id, feature)
        },
        [LEVEL_GREEN_AREAS]: loadSubAreasFromFeature,
        [LEVEL_SUB_AREAS]: loadSubAreasFromFeature,
      }
      actions[level]?.()
    },
    [
      level,
      breadcrumb,
      loadProvinces,
      loadMunicipalities,
      loadSubMunicipalAreas,
      loadGreenAreas,
      loadSubAreas,
      resolveRegionId,
    ]
  )

  const drillGreenArea = useCallback(
    (areaId: number, label: string, feature?: unknown) => {
      const regionId = resolveRegionId(feature)
      if (regionId == null) return
      void loadSubAreas(areaId, regionId, label, feature)
    },
    [resolveRegionId, loadSubAreas]
  )

  const jumpToSearchHit = useCallback(
    async (hit: TerritorySearchHit) => {
      if (!api) return
      await jumpToTerritorySearchHit({
        hit,
        api,
        bridge: bridgeRef.current,
        suffixProvince,
        labelGreenAreas,
        assetsActive: assetsActiveRef.current?.() ?? false,
        areasActive: areasActiveRef.current?.() ?? false,
        applyGeoJsonToBridge,
        clearTerritoryState,
        showGreenLayer,
        showLeafAreaFromFeature,
        setLevel,
        setBreadcrumb,
        withLoading,
        loadRegions,
      })
    },
    [
      api,
      suffixProvince,
      labelGreenAreas,
      applyGeoJsonToBridge,
      clearTerritoryState,
      showGreenLayer,
      showLeafAreaFromFeature,
      withLoading,
      loadRegions,
    ]
  )

  return {
    level,
    breadcrumb,
    loading,
    loadRegions,
    loadProvinces,
    loadMunicipalities,
    loadSubMunicipalAreas,
    loadGreenAreas,
    loadSubAreas,
    drillGreenArea,
    jumpToSearchHit,
    resyncMapLayers,
    navigateTo,
    goBack,
    handleFeatureSelect,
  }
}
