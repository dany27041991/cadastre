/**
 * Territory map feature selection contract.
 */
import type { TerritoryMapFeature } from './mapFeature'

export type FeatureSelectHandler = (
  id: number,
  label: string,
  feature?: TerritoryMapFeature
) => void
