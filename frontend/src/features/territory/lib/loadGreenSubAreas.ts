/**
 * Esplodi / Seleziona green area: resolve scope, breadcrumb, mount children or leaf.
 */
import { fetchDeepestGreenAreaChildren } from './greenAreaDrill'
import { resolveDrillScopeIds } from './resolveDrillScopeIds'
import { mountGreenDrillResult } from './mountGreenDrillResult'
import { resolveAdminBreadcrumbForGreenDrill } from './resolveAdminBreadcrumbForGreenDrill'
import { fetchGreenDetail } from '../api/greenDetail.api'
import type { TerritoryMapFeature } from '../types/mapFeature'
import type { BreadcrumbCrumb, MapBridge, TerritoryLevel, UseTerritoryNavigationOptions } from '../types'
import {
  GREEN_DETAIL_KIND_AREA,
  LEVEL_MUNICIPALITIES,
  LEVEL_PROVINCES,
  LEVEL_SUB_AREAS,
} from '../model/constants'

type TerritoryNavigationApi = NonNullable<UseTerritoryNavigationOptions['api']>

type ShowGreenLayer = (
  geojson: Parameters<MapBridge['loadGreenLayer']>[0],
  options?: { includeTerritoryBbox?: boolean; force?: boolean; skipFit?: boolean }
) => void

type ShowLeafArea = (
  feat: TerritoryMapFeature,
  options?: { includeTerritoryBbox?: boolean; force?: boolean; skipFit?: boolean }
) => void

export type LoadGreenSubAreasArgs = {
  api: TerritoryNavigationApi
  bridge: MapBridge
  breadcrumb: BreadcrumbCrumb[]
  areaId: number
  regionId: number
  label: string
  clickedFeature?: unknown
  labelGreenAreas: string
  suffixProvince: string
  assetsActive: boolean
  areasActive: boolean
  showGreenLayer: ShowGreenLayer
  showLeafAreaFromFeature: ShowLeafArea
  setLevel: (level: TerritoryLevel) => void
  setBreadcrumb: (crumbs: BreadcrumbCrumb[]) => void
}

export async function loadGreenSubAreas(args: LoadGreenSubAreasArgs): Promise<void> {
  const {
    api,
    bridge,
    breadcrumb,
    areaId,
    regionId,
    label,
    clickedFeature,
    labelGreenAreas,
    suffixProvince,
    assetsActive,
    areasActive,
    showGreenLayer,
    showLeafAreaFromFeature,
    setLevel,
    setBreadcrumb,
  } = args

  let { municipalityId, provinceId } = resolveDrillScopeIds(breadcrumb, clickedFeature)
  if (provinceId == null) return

  const needsAdminTrail =
    !breadcrumb.some((c) => c.level === LEVEL_PROVINCES) ||
    !breadcrumb.some((c) => c.level === LEVEL_MUNICIPALITIES)
  let detail = null as Awaited<ReturnType<typeof fetchGreenDetail>> | null
  if (needsAdminTrail || municipalityId == null) {
    try {
      detail = await fetchGreenDetail(GREEN_DETAIL_KIND_AREA, {
        id: areaId,
        regionId,
        provinceId,
      })
      municipalityId =
        municipalityId ??
        (detail.summary.municipalityId != null
          ? Number(detail.summary.municipalityId)
          : undefined)
    } catch {
      detail = null
    }
  }

  const childrenGeojson = await fetchDeepestGreenAreaChildren(
    api.getGreenAreas,
    areaId,
    regionId,
    provinceId,
    municipalityId
  )
  const isLeafSelect = (childrenGeojson.features?.length ?? 0) === 0

  const nextCrumbs = await resolveAdminBreadcrumbForGreenDrill({
    areaId,
    areaLabel: label,
    regionId,
    provinceId,
    municipalityId,
    feature: clickedFeature,
    detail,
    existing: breadcrumb,
    labelGreenAreas,
    suffixProvince,
    fetchSubMunicipalAreas: api.getSubMunicipalAreasByMunicipality,
    appendLeafUnderParent: isLeafSelect,
  })
  const resolvedMunicipalityId =
    [...nextCrumbs].reverse().find((c) => c.level === LEVEL_SUB_AREAS)?.municipalityId ??
    municipalityId

  bridge.clearGreenLayer()
  setLevel(LEVEL_SUB_AREAS)
  setBreadcrumb(nextCrumbs)
  if (clickedFeature) {
    bridge.storeLeafAreaForRestore?.(areaId, clickedFeature as TerritoryMapFeature)
  }

  await mountGreenDrillResult({
    bridge,
    getGreenAreas: api.getGreenAreas,
    areaId,
    regionId,
    provinceId,
    municipalityId: resolvedMunicipalityId,
    childrenGeojson,
    clickedFeature,
    assetsActive,
    areasActive,
    showGreenLayer,
    showLeafAreaFromFeature,
  })
}
