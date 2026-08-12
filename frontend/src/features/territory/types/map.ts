/**
 * Territory map feature selection contract.
 */
import type { TerritoryMapFeature } from './mapFeature'
import type { GreenMapLayerKind, MapLayerKind } from '../model/constants'

export type FeatureSelectHandler = (
  id: number,
  label: string,
  feature?: TerritoryMapFeature,
  /** Registry layer that produced the click; omit for territory / legacy callers. */
  layerKind?: MapLayerKind
) => void

/** Click on green area / asset opens detail modal (no auto-drill). */
export type GreenDetailSelectHandler = (
  id: number,
  label: string,
  feature: TerritoryMapFeature,
  layerKind: GreenMapLayerKind
) => void
