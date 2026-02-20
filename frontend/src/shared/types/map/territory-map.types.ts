/**
 * Type aliases for territory map hook.
 */
import type {
  TerritoryMapCoreApi,
  TerritoryMapGreenApi,
} from './territory-map.interfaces'

export type { FeatureSelectHandler } from './handler.types'

export type UseTerritoryMapResult = TerritoryMapCoreApi & TerritoryMapGreenApi
