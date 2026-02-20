/**
 * Territory navigation hook: state (level, breadcrumb), API fetch, map bridge callbacks.
 * API is injected by the caller (App) so shared never imports from api.
 */
import { useState, useCallback, useRef, useMemo } from 'react'
import { createLevelLoaders } from '@/shared/factory/loaders/mapNavigationLoaders'
import type { TerritoryLevel, BreadcrumbCrumb } from '@/shared/types/territory'
import type {
  MapBridge,
  UseTerritoryNavigationResult,
  MapBridgeFeature,
  MapBridgeGeo,
  UseTerritoryNavigationOptions,
} from '@/shared/types/navigation'

export type {
  MapBridge,
  UseTerritoryNavigationResult,
  MapBridgeFeature,
  MapBridgeGeo,
  UseTerritoryNavigationOptions,
} from '@/shared/types/navigation'

export function useTerritoryNavigation(
  mapBridge: MapBridge,
  options: UseTerritoryNavigationOptions
): UseTerritoryNavigationResult {
  const api = options.api
  const [level, setLevel] = useState<TerritoryLevel>('regions')
  const [breadcrumb, setBreadcrumb] = useState<BreadcrumbCrumb[]>([])
  const [loading, setLoading] = useState(false)
  const bridgeRef = useRef(mapBridge)
  bridgeRef.current = mapBridge

  const levelLoaders = useMemo(() => createLevelLoaders(api), [api])

  const loadRegions = useCallback(async () => {
    setLevel('regions')
    setBreadcrumb([])
    setLoading(true)
    try {
      const geojson = await api.getRegions()
      bridgeRef.current.loadGeoJson(geojson)
      bridgeRef.current.centerOnItaly()
    } finally {
      setLoading(false)
    }
  }, [api])

  const loadProvinces = useCallback(
    async (regionId: number, label: string) => {
      setLevel('provinces')
      setBreadcrumb([{ level: 'provinces', id: regionId, label }])
      setLoading(true)
      try {
        const geojson = await api.getProvincesByRegion(regionId)
        bridgeRef.current.loadGeoJson(geojson)
      } finally {
        setLoading(false)
      }
    },
    [api]
  )

  const loadMunicipalities = useCallback(
    async (provinceId: number, label: string) => {
      setLevel('municipalities')
      setBreadcrumb((prev: BreadcrumbCrumb[]) => [
        ...prev,
        { level: 'municipalities', id: provinceId, label: `${label} Province` },
      ])
      setLoading(true)
      try {
        const geojson = await api.getMunicipalitiesByProvince(provinceId)
        bridgeRef.current.loadGeoJson(geojson)
      } finally {
        setLoading(false)
      }
    },
    [api]
  )

  const loadDistricts = useCallback(
    async (
      regionId: number,
      municipalityId: number,
      label: string,
      clickedFeature?: unknown
    ) => {
      const ensureFeatureVisible = () => {
        if (clickedFeature) bridgeRef.current.showOnlyFeature(clickedFeature)
      }
      setLevel('districts')
      setBreadcrumb((prev: BreadcrumbCrumb[]) => {
        const last = prev[prev.length - 1]
        const newCrumb = { level: 'districts' as const, id: municipalityId, label }
        return last?.level === 'districts'
          ? [...prev.slice(0, -1), newCrumb]
          : [...prev, newCrumb]
      })
      ensureFeatureVisible()
      setLoading(true)
      try {
        const geojson = await api.getDistrictsByMunicipality(municipalityId)
        const hasFeatures = geojson.features && geojson.features.length > 0
        if (hasFeatures) {
          bridgeRef.current.loadGeoJson(geojson)
          return
        }
        ensureFeatureVisible()
        const areasGeojson = await api.getGreenAreas({
          regionId,
          municipalityId,
        })
        const hasAreas = areasGeojson.features && areasGeojson.features.length > 0
        if (!hasAreas) return
        setLevel('green_areas')
        setBreadcrumb((prev: BreadcrumbCrumb[]) => [
          ...prev,
          {
            level: 'green_areas',
            id: municipalityId,
            label: 'Green areas',
            regionId,
          },
        ])
        bridgeRef.current.loadGeoJson(areasGeojson)
        bridgeRef.current.fitToCurrentExtent()
      } catch {
        ensureFeatureVisible()
      } finally {
        setLoading(false)
      }
    },
    [api]
  )

  const loadGreenAreas = useCallback(
    async (
      regionId: number,
      municipalityId: number,
      districtLabel: string,
      districtId?: number,
      clickedFeature?: unknown
    ) => {
      setLevel('green_areas')
      setBreadcrumb((prev: BreadcrumbCrumb[]) => {
        const next = [...prev]
        const last = next[next.length - 1]
        if (last?.level === 'districts' && districtLabel) {
          next[next.length - 1] = { ...last, label: districtLabel }
        }
        return [
          ...next,
          {
            level: 'green_areas',
            id: municipalityId,
            label: 'Green areas',
            districtId,
            regionId,
          },
        ]
      })
      if (clickedFeature) {
        bridgeRef.current.showOnlyFeature(clickedFeature)
      }
      setLoading(true)
      try {
        const geojson = await api.getGreenAreas({
          regionId,
          municipalityId,
          districtId,
        })
        const hasFeatures = geojson.features && geojson.features.length > 0
        if (hasFeatures) {
          bridgeRef.current.loadGeoJson(geojson)
          bridgeRef.current.fitToCurrentExtent()
        }
      } finally {
        setLoading(false)
      }
    },
    [api]
  )

  const loadSubAreas = useCallback(
    async (
      areaId: number,
      regionId: number,
      label: string,
      clickedFeature?: unknown
    ) => {
      setLevel('sub_areas')
      setBreadcrumb((prev: BreadcrumbCrumb[]) => [
        ...prev,
        { level: 'sub_areas', id: areaId, label, regionId },
      ])
      if (clickedFeature) {
        bridgeRef.current.showOnlyFeature(clickedFeature)
      }
      setLoading(true)
      try {
        const geojson = await api.getGreenAreas({
          regionId,
          parentId: areaId,
        })
        const hasFeatures = geojson.features && geojson.features.length > 0
        if (hasFeatures) {
          bridgeRef.current.loadGeoJson(geojson)
          bridgeRef.current.fitToCurrentExtent()
        }
      } finally {
        setLoading(false)
      }
    },
    [api]
  )

  const navigateTo = useCallback(
    async (index: number) => {
      if (index < 0) {
        await loadRegions()
        return
      }
      const newCrumb = breadcrumb.slice(0, index + 1)
      setBreadcrumb(newCrumb)
      const last = newCrumb[newCrumb.length - 1]
      const loader = levelLoaders[last.level as keyof typeof levelLoaders]
      if (!loader) return

      setLevel(last.level)
      setLoading(true)
      try {
        const geojson = await loader(last)
        bridgeRef.current.loadGeoJson(geojson)
        bridgeRef.current.fitToCurrentExtent()
      } finally {
        setLoading(false)
      }
    },
    [breadcrumb, loadRegions, levelLoaders]
  )

  const goBack = useCallback(
    () => navigateTo(breadcrumb.length - 2),
    [breadcrumb.length, navigateTo]
  )

  const handleFeatureSelect = useCallback(
    (id: number, label: string, feature?: unknown) => {
      const regionIdFromCrumb = breadcrumb[0]?.id
      const municipalityId = breadcrumb[breadcrumb.length - 1]?.id
      const getRegionIdFromFeature = (): number | undefined => {
        const props = (feature as { getProperties?: () => Record<string, unknown> })
          ?.getProperties?.()
        return props?.region_id as number | undefined
      }
      const actions: Partial<Record<TerritoryLevel, () => void>> = {
        regions: () => loadProvinces(id, label),
        provinces: () => loadMunicipalities(id, label),
        municipalities: () => loadDistricts(regionIdFromCrumb ?? 0, id, label, feature),
        districts: () => {
          if (municipalityId != null && regionIdFromCrumb != null && feature)
            loadGreenAreas(regionIdFromCrumb, municipalityId, label, id, feature)
        },
        green_areas: () => {
          const regionId = feature ? getRegionIdFromFeature() : undefined
          if (regionId != null) loadSubAreas(id, regionId, label, feature)
        },
        sub_areas: () => {
          const regionId = feature ? getRegionIdFromFeature() : undefined
          if (regionId != null) loadSubAreas(id, regionId, label, feature)
        },
      }
      const run = actions[level as keyof typeof actions]
      if (run) run()
    },
    [
      level,
      breadcrumb,
      loadProvinces,
      loadMunicipalities,
      loadDistricts,
      loadGreenAreas,
      loadSubAreas,
    ]
  )

  return {
    level,
    breadcrumb,
    loading,
    loadRegions,
    loadProvinces,
    loadMunicipalities,
    loadDistricts,
    loadGreenAreas,
    loadSubAreas,
    navigateTo,
    goBack,
    handleFeatureSelect,
  }
}
