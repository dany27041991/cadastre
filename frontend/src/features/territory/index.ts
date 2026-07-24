/**
 * Territory feature: public API.
 */
export { territoryApi, createTerritoryApi } from './api/territory.api'
export type { TerritoryApi, TerritoryNavigationApi } from './api/territory.api'
export { useTerritoryNavigation } from './model'
export { useGeoinsightMapBridge } from '@/features/territory-map-geoinsight'
export { LEVEL_GREEN_AREAS, LEVEL_SUB_AREAS, I18N_KEYS } from './model/constants'
export type {
  MapBridge,
  UseTerritoryNavigationResult,
  UseTerritoryNavigationOptions,
  FeatureSelectHandler,
} from './types'
export type { UseGeoinsightMapBridgeResult } from '@/features/territory-map-geoinsight'
export { MapBreadcrumbs } from './ui/map-breadcrumbs/MapBreadcrumbs'
export { MapHeader } from './ui/map-header/MapHeader'
export type {
  TerritoryLevel,
  BreadcrumbCrumb,
  MapBreadcrumbsProps,
  MapHeaderProps,
  GreenContext,
} from './types'
