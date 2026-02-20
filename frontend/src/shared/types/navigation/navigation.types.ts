/**
 * Type aliases for territory navigation.
 */
import type {
  MapBridgeFeature,
  MapBridgeGeo,
  TerritoryNavigationActions,
  TerritoryNavigationLoaders,
  TerritoryNavigationState,
} from './navigation.interfaces'

export type MapBridge = MapBridgeGeo & MapBridgeFeature

export type UseTerritoryNavigationResult = TerritoryNavigationState &
  TerritoryNavigationLoaders &
  TerritoryNavigationActions
