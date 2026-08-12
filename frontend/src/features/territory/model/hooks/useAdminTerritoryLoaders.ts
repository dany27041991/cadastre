/**
 * Admin territory drill loaders: regions → provinces → municipalities → sub-municipal → green_areas.
 */
import { useCallback, type Dispatch, type MutableRefObject, type SetStateAction } from 'react'
import { filterSubMunicipalByDrill } from '../../lib/subMunicipalDrill'
import { hasGeoJsonFeatures } from '../../lib/geoJsonHelpers'
import type { TerritoryMapFeature } from '../../types/mapFeature'
import type {
  BreadcrumbCrumb,
  MapBridge,
  TerritoryLevel,
  UseTerritoryNavigationOptions,
} from '../../types'
import {
  LEVEL_GREEN_AREAS,
  LEVEL_MUNICIPALITIES,
  LEVEL_PROVINCES,
  LEVEL_REGIONS,
  LEVEL_SUB_MUNICIPAL_AREAS,
} from '../constants'

type TerritoryNavigationApi = NonNullable<UseTerritoryNavigationOptions['api']>

type ShowGreenLayer = (
  geojson: Parameters<MapBridge['loadGreenLayer']>[0],
  options?: { includeTerritoryBbox?: boolean; force?: boolean; skipFit?: boolean }
) => void

export type UseAdminTerritoryLoadersArgs = {
  api: TerritoryNavigationApi | undefined
  bridgeRef: MutableRefObject<MapBridge>
  assetsActiveRef: MutableRefObject<(() => boolean) | undefined>
  breadcrumb: BreadcrumbCrumb[]
  labelGreenAreas: string
  suffixProvince: string
  withLoading: (fn: () => Promise<void>) => Promise<void>
  clearTerritoryState: () => void
  applyGeoJsonToBridge: (geojson: Parameters<MapBridge['loadGeoJson']>[0], fit?: boolean) => void
  showGreenLayer: ShowGreenLayer
  setLevel: Dispatch<SetStateAction<TerritoryLevel>>
  setBreadcrumb: Dispatch<SetStateAction<BreadcrumbCrumb[]>>
}

export function useAdminTerritoryLoaders(args: UseAdminTerritoryLoadersArgs) {
  const {
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
  } = args

  const loadRegions = useCallback(async (options?: { fit?: boolean }) => {
    if (!api) return
    const fit = options?.fit !== false
    clearTerritoryState()
    setLevel(LEVEL_REGIONS)
    setBreadcrumb([])
    await withLoading(async () => {
      const geojson = await api.getRegions()
      bridgeRef.current.loadGeoJson(geojson)
      if (fit) bridgeRef.current.fitToCurrentExtent()
    })
  }, [api, withLoading, clearTerritoryState, bridgeRef, setLevel, setBreadcrumb])

  const loadProvinces = useCallback(
    async (regionId: number, label: string) => {
      if (!api) return
      clearTerritoryState()
      setLevel(LEVEL_PROVINCES)
      setBreadcrumb([{ level: LEVEL_PROVINCES, id: regionId, label }])
      await withLoading(async () => {
        const geojson = await api.getProvincesByRegion(regionId)
        applyGeoJsonToBridge(geojson)
      })
    },
    [api, withLoading, applyGeoJsonToBridge, clearTerritoryState, setLevel, setBreadcrumb]
  )

  const loadMunicipalities = useCallback(
    async (provinceId: number, label: string) => {
      if (!api) return
      clearTerritoryState()
      setLevel(LEVEL_MUNICIPALITIES)
      setBreadcrumb((prev) => [
        ...prev,
        { level: LEVEL_MUNICIPALITIES, id: provinceId, label: `${label}${suffixProvince}` },
      ])
      await withLoading(async () => {
        const geojson = await api.getMunicipalitiesByProvince(provinceId)
        applyGeoJsonToBridge(geojson)
      })
    },
    [api, withLoading, applyGeoJsonToBridge, clearTerritoryState, suffixProvince, setLevel, setBreadcrumb]
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
      setLevel(LEVEL_GREEN_AREAS)
      setBreadcrumb((prev) => {
        const last = prev[prev.length - 1]
        const resolvedProvinceId =
          provinceId ?? prev.find((c) => c.level === LEVEL_MUNICIPALITIES)?.id
        return [
          ...prev.slice(0, -1),
          ...(last ? [{ ...last, navigable: false }] : []),
          {
            level: LEVEL_GREEN_AREAS,
            id: municipalityId,
            label: labelGreenAreas,
            regionId,
            provinceId: resolvedProvinceId,
          },
        ]
      })
      showGreenLayer(areasGeojson)
    },
    [api, labelGreenAreas, showGreenLayer, setLevel, setBreadcrumb]
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
      setLevel(LEVEL_SUB_MUNICIPAL_AREAS)
      setBreadcrumb((prev) => {
        const last = prev[prev.length - 1]
        const newCrumb: BreadcrumbCrumb = {
          level: LEVEL_SUB_MUNICIPAL_AREAS,
          id: municipalityId,
          label,
        }
        return last?.level === LEVEL_SUB_MUNICIPAL_AREAS
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
    [
      api,
      withLoading,
      jumpToGreenAreasWhenMunicipalityHasNoSubAreas,
      applyGeoJsonToBridge,
      clearTerritoryState,
      bridgeRef,
      setLevel,
      setBreadcrumb,
    ]
  )

  const loadGreenAreas = useCallback(
    async (
      regionId: number,
      municipalityId: number,
      subMunicipalAreaLabel: string,
      subMunicipalAreaId?: number,
      clickedFeature?: unknown
    ) => {
      if (!api) return
      const assetsActive = assetsActiveRef.current?.() ?? false
      // Keep viewport clusters when the assets toggle is on: showGreenLayer would
      // reset greenAssetClusteringActive after the scope effect had already re-armed it.
      if (!assetsActive) {
        bridgeRef.current.clearGreenLayer()
      }
      // Keep the selected sub-municipal (or municipality) admin boundary visible.
      if (clickedFeature) {
        bridgeRef.current.showOnlyFeature(clickedFeature as TerritoryMapFeature)
      } else if (subMunicipalAreaId != null) {
        const subGeo = await api.getSubMunicipalAreasByMunicipality(municipalityId)
        if (hasGeoJsonFeatures(subGeo)) {
          bridgeRef.current.loadGeoJsonAndShowOnlyFeatureById(subGeo, subMunicipalAreaId)
        }
      }
      setLevel(LEVEL_GREEN_AREAS)
      setBreadcrumb((prev) => {
        const last = prev[prev.length - 1]
        const provinceId = prev.find((c) => c.level === LEVEL_MUNICIPALITIES)?.id
        if (
          last?.level === LEVEL_GREEN_AREAS &&
          last?.id === municipalityId &&
          last?.subMunicipalAreaId === subMunicipalAreaId
        ) {
          return prev
        }
        return [
          ...prev,
          {
            level: LEVEL_GREEN_AREAS,
            id: municipalityId,
            label:
              subMunicipalAreaId != null && subMunicipalAreaLabel
                ? subMunicipalAreaLabel
                : labelGreenAreas,
            subMunicipalAreaId,
            regionId,
            provinceId,
          },
        ]
      })
      if (assetsActive) return
      await withLoading(async () => {
        const provinceId = breadcrumb.find((c) => c.level === LEVEL_MUNICIPALITIES)?.id
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
    [
      api,
      withLoading,
      labelGreenAreas,
      showGreenLayer,
      breadcrumb,
      assetsActiveRef,
      bridgeRef,
      setLevel,
      setBreadcrumb,
    ]
  )

  return {
    loadRegions,
    loadProvinces,
    loadMunicipalities,
    loadSubMunicipalAreas,
    loadGreenAreas,
  }
}
