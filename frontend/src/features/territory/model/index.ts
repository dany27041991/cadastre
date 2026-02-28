/**
 * Territory feature model: hooks and data fetchers (state + orchestration).
 */
export { useTerritoryMap } from './hooks/useTerritoryMap'
export type { FeatureSelectHandler, UseTerritoryMapResult, UseTerritoryMapOptions } from './hooks/useTerritoryMap'
export { useTerritoryNavigation } from './hooks/useTerritoryNavigation'
export type { MapBridge, UseTerritoryNavigationResult, UseTerritoryNavigationOptions } from './hooks/useTerritoryNavigation'
export { createLevelFetchers } from './fetchers/mapNavigationFetchers'
export { createGreenAreasLevelFetchers } from './fetchers/levelFetchers'
