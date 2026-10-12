/**
 * Restore map layers for a breadcrumb tip (navigateTo / resyncMapLayers).
 */
import { hasGeoJsonFeatures } from './geoJsonHelpers'
import { handleGreenLevelNavigation } from './greenLevelMapSync'
import type { TerritoryMapFeature } from '../types/mapFeature'
import type { BreadcrumbCrumb, MapBridge, UseTerritoryNavigationOptions } from '../types'
import {
  LEVEL_GREEN_AREAS,
  LEVEL_SUB_AREAS,
  LEVEL_SUB_MUNICIPAL_AREAS,
} from '../model/constants'

type TerritoryNavigationApi = NonNullable<UseTerritoryNavigationOptions['api']>
type LevelFetcher = (last: BreadcrumbCrumb) => Promise<Parameters<MapBridge['loadGeoJson']>[0]>

type ShowGreenLayer = (g: Parameters<MapBridge['loadGreenLayer']>[0]) => void
type ShowLeafArea = (f: TerritoryMapFeature) => void

export type RestoreMapForBreadcrumbArgs = {
  api: TerritoryNavigationApi | undefined
  bridge: MapBridge
  crumb: BreadcrumbCrumb[]
  last: BreadcrumbCrumb
  fetcher: LevelFetcher
  assetsLayerActive: boolean
  showGreenLayer: ShowGreenLayer
  showLeafAreaFromFeature: ShowLeafArea
  applyGeoJsonToBridge: (geojson: Parameters<MapBridge['loadGeoJson']>[0], fit?: boolean) => void
  clearTerritoryState?: () => void
}

export async function restoreMapForBreadcrumb(args: RestoreMapForBreadcrumbArgs): Promise<void> {
  const {
    api,
    bridge,
    crumb,
    last,
    fetcher,
    assetsLayerActive,
    showGreenLayer,
    showLeafAreaFromFeature,
    applyGeoJsonToBridge,
    clearTerritoryState,
  } = args

  const geojson = await fetcher(last)
  if (
    last.level === LEVEL_SUB_MUNICIPAL_AREAS &&
    !hasGeoJsonFeatures(geojson) &&
    crumb.length >= 2 &&
    api
  ) {
    const provinceCrumb = crumb[crumb.length - 2]
    const municipalitiesGeojson = await api.getMunicipalitiesByProvince(provinceCrumb.id)
    bridge.loadGeoJsonAndShowOnlyFeatureById(municipalitiesGeojson, last.id)
    return
  }
  if (last.level === LEVEL_GREEN_AREAS || last.level === LEVEL_SUB_AREAS) {
    await handleGreenLevelNavigation(
      last,
      crumb,
      geojson,
      api,
      bridge,
      showGreenLayer,
      showLeafAreaFromFeature,
      assetsLayerActive
    )
    return
  }
  clearTerritoryState?.()
  applyGeoJsonToBridge(geojson, true)
}
