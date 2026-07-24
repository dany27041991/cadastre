/**
 * Territory navigation hook: state (level, breadcrumb), API fetch, map bridge.
 */
import { useState, useCallback, useRef, useMemo } from 'react'
import { createLevelFetchers } from '../fetchers/mapNavigationFetchers'
import { filterSubMunicipalByDrill } from '../../lib/subMunicipalDrill'
import { filterGreenAreaChildren } from '../../lib/greenAreaDrill'
import type { TerritoryMapFeature } from '../../types/mapFeature'
import { getRegionIdFromMapFeature } from '../../lib/featureIdentity'
import type {
  TerritoryLevel,
  BreadcrumbCrumb,
  MapBridge,
  UseTerritoryNavigationResult,
  UseTerritoryNavigationOptions,
} from '../../types'
import { I18N_KEYS, LABEL_GREEN_AREAS, SUFFIX_PROVINCE } from '../constants'

type TerritoryNavigationApi = NonNullable<UseTerritoryNavigationOptions['api']>

export type { MapBridge, UseTerritoryNavigationResult, UseTerritoryNavigationOptions } from '../../types'

function hasGeoJsonFeatures(geojson: { features?: unknown[] }): boolean {
  return Boolean(geojson.features?.length)
}

type GreenLayerGeoJson = Parameters<MapBridge['loadGreenLayer']>[0]

async function handleGreenLevelNavigation(
  last: BreadcrumbCrumb,
  newCrumb: BreadcrumbCrumb[],
  geojson: GreenLayerGeoJson,
  api: TerritoryNavigationApi | undefined,
  bridge: MapBridge,
  showGreenLayer: (g: GreenLayerGeoJson) => void,
  showLeafArea: (f: TerritoryMapFeature) => void,
  assetsLayerActive: boolean
): Promise<void> {
  // Assets toggle owns the green layer (viewport clusters). Clearing/replacing
  // it with area polygons races the scope refetch and leaves the map without clusters.
  if (!assetsLayerActive) {
    bridge.clearGreenLayer()
  }
  bridge.clearTerritoryLayer()
  if (api) await loadTerritoryForGreenLevel(api, bridge, newCrumb, last)
  if (assetsLayerActive) return
  if (hasGeoJsonFeatures(geojson)) {
    const toShow =
      last.level === 'sub_areas'
        ? filterGreenAreaChildren(geojson, last.id)
        : geojson
    showGreenLayer(toShow)
  } else {
    const leafFeature = last.level === 'sub_areas' ? bridge.getStoredLeafArea?.(last.id) : undefined
    if (leafFeature) showLeafArea(leafFeature)
    else bridge.clearGreenLayer()
  }
}

function geoJsonHasFeatureId(
  geojson: { features?: Array<{ id?: number; properties?: { id?: number } }> },
  featureId: number
): boolean {
  return Boolean(
    geojson.features?.some(
      (f) => f.id === featureId || f.properties?.id === featureId
    )
  )
}

async function loadTerritoryForGreenLevel(
  api: TerritoryNavigationApi,
  bridge: MapBridge,
  newCrumb: BreadcrumbCrumb[],
  last: BreadcrumbCrumb
): Promise<void> {
  if (last.level === 'sub_areas' && last.regionId != null && last.provinceId != null && newCrumb.length >= 2) {
    const parentCrumb = newCrumb[newCrumb.length - 2]
    if (parentCrumb.level === 'green_areas') {
      /**
       * green_areas crumb id is municipality_id, not a green area id.
       * parent_id on API = children of that *green area* → wrong query if we pass municipality id.
       * Load roots for the municipality and highlight `last` only if it is a root; otherwise
       * skip vector outline (green layer will show sub-areas + fit).
       */
      const munGeo = await api.getGreenAreas({
        regionId: last.regionId,
        provinceId: last.provinceId,
        municipalityId: parentCrumb.id,
        subMunicipalAreaId: parentCrumb.subMunicipalAreaId,
      })
      if (hasGeoJsonFeatures(munGeo) && geoJsonHasFeatureId(munGeo, last.id)) {
        bridge.loadGeoJsonAndShowOnlyFeatureById(munGeo, last.id)
      }
      return
    }
    /** Parent crumb is sub_areas: parentCrumb.id is a green area → API parent_id is correct. */
    const parentGeo = await api.getGreenAreas({
      regionId: last.regionId,
      provinceId: last.provinceId,
      parentId: parentCrumb.id,
    })
    if (hasGeoJsonFeatures(parentGeo)) {
      bridge.loadGeoJsonAndShowOnlyFeatureById(parentGeo, last.id)
    }
    return
  }
  if (last.level !== 'green_areas' || last.regionId == null) return
  if (last.subMunicipalAreaId != null) {
    const subGeo = await api.getSubMunicipalAreasByMunicipality(last.id)
    if (hasGeoJsonFeatures(subGeo)) {
      bridge.loadGeoJsonAndShowOnlyFeatureById(subGeo, last.subMunicipalAreaId)
    }
    return
  }
  const municipalitiesCrumb = newCrumb.find((c) => c.level === 'municipalities')
  if (municipalitiesCrumb) {
    const munGeo = await api.getMunicipalitiesByProvince(municipalitiesCrumb.id)
    if (hasGeoJsonFeatures(munGeo)) {
      bridge.loadGeoJsonAndShowOnlyFeatureById(munGeo, last.id)
    }
  }
}

export function useTerritoryNavigation(
  mapBridge: MapBridge,
  options: UseTerritoryNavigationOptions
): UseTerritoryNavigationResult {
  const api = options.api
  const t = options.t
  const isAssetsLayerActive = options.isAssetsLayerActive
  const labelGreenAreas = t ? t(I18N_KEYS.greenAreas) : LABEL_GREEN_AREAS
  const suffixProvince = t ? t(I18N_KEYS.provinceSuffix) : SUFFIX_PROVINCE
  const [level, setLevel] = useState<TerritoryLevel>('regions')
  const [breadcrumb, setBreadcrumb] = useState<BreadcrumbCrumb[]>([])
  const [loading, setLoading] = useState(false)
  const bridgeRef = useRef(mapBridge)
  bridgeRef.current = mapBridge
  const navigateInProgressRef = useRef(false)
  const assetsActiveRef = useRef(isAssetsLayerActive)
  assetsActiveRef.current = isAssetsLayerActive

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

  const showGreenLayer = useCallback(
    (
      geojson: Parameters<MapBridge['loadGreenLayer']>[0],
      options?: { includeTerritoryBbox?: boolean }
    ) => {
      bridgeRef.current.setTerritoryFillVisible(false)
      bridgeRef.current.loadGreenLayer(geojson, { skipFit: true })
      bridgeRef.current.setGreenLayerVisibleWhenMoveEnds()
      bridgeRef.current.fitToGreenExtent(options?.includeTerritoryBbox ?? true)
      bridgeRef.current.ensureGreenLayerVisibleAfterFit()
    },
    []
  )

  const showLeafAreaFromFeature = useCallback(
    (feat: TerritoryMapFeature, options?: { includeTerritoryBbox?: boolean }) => {
      bridgeRef.current.loadGreenLayerFromFeature(feat)
      bridgeRef.current.setTerritoryFillVisible(false)
      bridgeRef.current.setGreenLayerVisible(true)
      bridgeRef.current.fitToGreenExtent(options?.includeTerritoryBbox ?? true)
    },
    []
  )

  const loadRegions = useCallback(async () => {
    if (!api) return
    clearTerritoryState()
    setLevel('regions')
    setBreadcrumb([])
    await withLoading(async () => {
      const geojson = await api.getRegions()
      bridgeRef.current.loadGeoJson(geojson)
      bridgeRef.current.fitToCurrentExtent()
    })
  }, [api, withLoading, clearTerritoryState])

  const loadProvinces = useCallback(
    async (regionId: number, label: string) => {
      if (!api) return
      clearTerritoryState()
      setLevel('provinces')
      setBreadcrumb([{ level: 'provinces', id: regionId, label }])
      await withLoading(async () => {
        const geojson = await api.getProvincesByRegion(regionId)
        applyGeoJsonToBridge(geojson)
      })
    },
    [api, withLoading, applyGeoJsonToBridge, clearTerritoryState]
  )

  const loadMunicipalities = useCallback(
    async (provinceId: number, label: string) => {
      if (!api) return
      clearTerritoryState()
      setLevel('municipalities')
      setBreadcrumb((prev) => [
        ...prev,
        { level: 'municipalities', id: provinceId, label: `${label}${suffixProvince}` },
      ])
      await withLoading(async () => {
        const geojson = await api.getMunicipalitiesByProvince(provinceId)
        applyGeoJsonToBridge(geojson)
      })
    },
    [api, withLoading, applyGeoJsonToBridge, clearTerritoryState, suffixProvince]
  )

  const jumpToGreenAreasWhenMunicipalityHasNoSubAreas = useCallback(
    async (regionId: number, municipalityId: number, provinceId?: number) => {
      if (!api || provinceId == null) return
      const areasGeojson = await api.getGreenAreas({
        regionId,
        provinceId,
        municipalityId,
      })
      if (!hasGeoJsonFeatures(areasGeojson)) return
      setLevel('green_areas')
      setBreadcrumb((prev) => {
        const last = prev[prev.length - 1]
        const resolvedProvinceId = provinceId ?? prev.find((c) => c.level === 'municipalities')?.id
        return [
          ...prev.slice(0, -1),
          ...(last ? [{ ...last, navigable: false }] : []),
          {
            level: 'green_areas',
            id: municipalityId,
            label: labelGreenAreas,
            regionId,
            provinceId: resolvedProvinceId,
          },
        ]
      })
      showGreenLayer(areasGeojson)
    },
    [api, labelGreenAreas, showGreenLayer]
  )

  const loadSubMunicipalAreas = useCallback(
    async (
      regionId: number,
      municipalityId: number,
      label: string,
      clickedFeature?: unknown,
      provinceId?: number
    ) => {
      if (!api) return
      clearTerritoryState()
      const ensureFeatureVisible = () => {
        if (clickedFeature) bridgeRef.current.showOnlyFeature(clickedFeature as TerritoryMapFeature)
      }
      setLevel('sub_municipal_areas')
      setBreadcrumb((prev) => {
        const last = prev[prev.length - 1]
        const newCrumb: BreadcrumbCrumb = { level: 'sub_municipal_areas', id: municipalityId, label }
        return last?.level === 'sub_municipal_areas'
          ? [...prev.slice(0, -1), newCrumb]
          : [...prev, newCrumb]
      })
      ensureFeatureVisible()
      await withLoading(async () => {
        try {
          const geojson = await api.getSubMunicipalAreasByMunicipality(municipalityId)
          const filtered = filterSubMunicipalByDrill(geojson, 1, [])
          if (hasGeoJsonFeatures(filtered)) {
            applyGeoJsonToBridge(filtered)
            return
          }
          ensureFeatureVisible()
          await jumpToGreenAreasWhenMunicipalityHasNoSubAreas(
            regionId,
            municipalityId,
            provinceId
          )
        } catch {
          ensureFeatureVisible()
        }
      })
    },
    [api, withLoading, jumpToGreenAreasWhenMunicipalityHasNoSubAreas, applyGeoJsonToBridge, clearTerritoryState]
  )

  const loadGreenAreas = useCallback(
    async (
      regionId: number,
      municipalityId: number,
      subMunicipalAreaLabel: string,
      subMunicipalAreaId?: number,
      _clickedFeature?: unknown
    ) => {
      if (!api) return
      const assetsActive = assetsActiveRef.current?.() ?? false
      // Keep viewport clusters when the assets toggle is on: showGreenLayer would
      // reset greenAssetClusteringActive after the scope effect had already re-armed it.
      if (!assetsActive) {
        bridgeRef.current.clearGreenLayer()
      }
      bridgeRef.current.setTerritoryFillVisible(false)
      setLevel('green_areas')
      setBreadcrumb((prev) => {
        const last = prev[prev.length - 1]
        const provinceId = prev.find((c) => c.level === 'municipalities')?.id
        if (
          last?.level === 'green_areas' &&
          last?.id === municipalityId &&
          last?.subMunicipalAreaId === subMunicipalAreaId
        ) {
          return prev
        }
        return [
          ...prev,
          {
            level: 'green_areas',
            id: municipalityId,
            label: subMunicipalAreaId != null && subMunicipalAreaLabel ? subMunicipalAreaLabel : labelGreenAreas,
            subMunicipalAreaId,
            regionId,
            provinceId,
          },
        ]
      })
      if (assetsActive) return
      await withLoading(async () => {
        const provinceId = breadcrumb.find((c) => c.level === 'municipalities')?.id
        if (provinceId == null) return
        const geojson = await api.getGreenAreas({
          regionId,
          provinceId,
          municipalityId,
          subMunicipalAreaId,
        })
        if (hasGeoJsonFeatures(geojson)) showGreenLayer(geojson)
      })
    },
    [api, withLoading, labelGreenAreas, showGreenLayer, breadcrumb]
  )

  const loadSubAreas = useCallback(
    async (
      areaId: number,
      regionId: number,
      label: string,
      clickedFeature?: unknown
    ) => {
      if (!api) return
      const municipalityId = breadcrumb.find((c) => c.level === 'green_areas')?.id
      const provinceId = breadcrumb.find((c) => c.level === 'green_areas')?.provinceId ?? breadcrumb.find((c) => c.level === 'municipalities')?.id
      if (provinceId == null || municipalityId == null) return
      const assetsActive = assetsActiveRef.current?.() ?? false
      if (!assetsActive) {
        bridgeRef.current.clearGreenLayer()
      }
      bridgeRef.current.setTerritoryFillVisible(false)
      setLevel('sub_areas')
      setBreadcrumb((prev) => {
        const last = prev[prev.length - 1]
        if (last?.level === 'sub_areas' && last?.id === areaId) return prev
        return [...prev, { level: 'sub_areas', id: areaId, label, regionId, provinceId, municipalityId }]
      })
      if (assetsActive) {
        if (clickedFeature) {
          bridgeRef.current.storeLeafAreaForRestore?.(areaId, clickedFeature as TerritoryMapFeature)
        }
        return
      }
      await withLoading(async () => {
        const geojson = await api.getGreenAreas({
          regionId,
          provinceId,
          municipalityId,
          containedInAreaId: areaId,
        })
        const childrenGeojson = filterGreenAreaChildren(geojson, areaId)
        if (hasGeoJsonFeatures(childrenGeojson)) {
          // Drill-in: frame the clicked area's children, not the stored
          // territory (municipality) bbox used by breadcrumb navigation.
          showGreenLayer(childrenGeojson, { includeTerritoryBbox: false })
        } else if (clickedFeature) {
          const feat = clickedFeature as TerritoryMapFeature
          bridgeRef.current.storeLeafAreaForRestore?.(areaId, feat)
          showLeafAreaFromFeature(feat, { includeTerritoryBbox: false })
        }
      })
    },
    [api, breadcrumb, withLoading, showGreenLayer, showLeafAreaFromFeature]
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
      if (last.level !== 'green_areas' && last.level !== 'sub_areas') {
        clearTerritoryState()
      }
      const fetcher = levelFetchers[last.level]
      if (!fetcher) {
        return
      }

      navigateInProgressRef.current = true
      setLevel(last.level)
      try {
        await withLoading(async () => {
          const geojson = await fetcher(last)
          if (
            last.level === 'sub_municipal_areas' &&
            !hasGeoJsonFeatures(geojson) &&
            newCrumb.length >= 2 &&
            api
          ) {
            const provinceCrumb = newCrumb[newCrumb.length - 2]
            const municipalitiesGeojson = await api.getMunicipalitiesByProvince(provinceCrumb.id)
            bridgeRef.current.loadGeoJsonAndShowOnlyFeatureById(municipalitiesGeojson, last.id)
          } else if (last.level === 'green_areas' || last.level === 'sub_areas') {
            await handleGreenLevelNavigation(
              last,
              newCrumb,
              geojson,
              api,
              bridgeRef.current,
              showGreenLayer,
              showLeafAreaFromFeature,
              assetsActiveRef.current?.() ?? false
            )
          } else {
            applyGeoJsonToBridge(geojson, true)
          }
        })
      } finally {
        navigateInProgressRef.current = false
      }
    },
    [api, breadcrumb, loadRegions, levelFetchers, withLoading, applyGeoJsonToBridge, clearTerritoryState, showGreenLayer, showLeafAreaFromFeature]
  )

  const resyncMapLayers = useCallback(async () => {
    if (!api) return
    if (level === 'regions' && breadcrumb.length === 0) {
      await loadRegions()
      return
    }
    if (breadcrumb.length === 0) {
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

    await withLoading(async () => {
      const geojson = await fetcher(last)
      if (last.level === 'green_areas' || last.level === 'sub_areas') {
        await handleGreenLevelNavigation(
          last,
          breadcrumb,
          geojson,
          api,
          bridgeRef.current,
          showGreenLayer,
          showLeafAreaFromFeature,
          assetsActiveRef.current?.() ?? false
        )
        return
      }
      if (
        last.level === 'sub_municipal_areas' &&
        !hasGeoJsonFeatures(geojson) &&
        breadcrumb.length >= 2
      ) {
        const provinceCrumb = breadcrumb[breadcrumb.length - 2]
        const municipalitiesGeojson = await api.getMunicipalitiesByProvince(provinceCrumb.id)
        bridgeRef.current.loadGeoJsonAndShowOnlyFeatureById(municipalitiesGeojson, last.id)
        return
      }
      clearTerritoryState()
      applyGeoJsonToBridge(geojson, true)
    })
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

  const handleFeatureSelect = useCallback(
    (id: number, label: string, feature?: unknown) => {
      const regionIdFromCrumb = breadcrumb[0]?.id
      const municipalityId = breadcrumb[breadcrumb.length - 1]?.id
      const loadSubAreasFromFeature = () => {
        const regionIdFromFeature = feature ? getRegionIdFromMapFeature(feature) : undefined
        const regionIdFromBreadcrumb = [...breadcrumb]
          .reverse()
          .find((crumb) => crumb.regionId != null)?.regionId
        const regionId = regionIdFromFeature ?? regionIdFromBreadcrumb ?? regionIdFromCrumb
        if (regionId != null) loadSubAreas(id, regionId, label, feature)
      }
      const actions: Partial<Record<TerritoryLevel, () => void>> = {
        regions: () => { loadProvinces(id, label) },
        provinces: () => { loadMunicipalities(id, label) },
        municipalities: () => {
          const provinceId = breadcrumb[1]?.id
          loadSubMunicipalAreas(regionIdFromCrumb ?? 0, id, label, feature, provinceId)
        },
        sub_municipal_areas: () => {
          if (regionIdFromCrumb != null && municipalityId != null && feature)
            loadGreenAreas(regionIdFromCrumb, municipalityId, label, id, feature)
        },
        green_areas: loadSubAreasFromFeature,
        sub_areas: loadSubAreasFromFeature,
      }
      const run = actions[level]
      if (run) run()
    },
    [level, breadcrumb, loadProvinces, loadMunicipalities, loadSubMunicipalAreas, loadGreenAreas, loadSubAreas]
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
    resyncMapLayers,
    navigateTo,
    goBack,
    handleFeatureSelect,
  }
}
