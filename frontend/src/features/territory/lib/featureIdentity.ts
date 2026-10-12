/**
 * Feature id/label helpers shared by map engines.
 */
import type { TerritoryMapFeature } from '../types/mapFeature'
import { getFeatureLabel } from './featureLabels'

export function resolveFeatureId(
  properties: Record<string, unknown>,
  explicitId?: number
): number {
  if (explicitId != null && Number.isFinite(explicitId)) return explicitId
  const raw = properties.id ?? properties.ol_uid
  return typeof raw === 'number' ? raw : Number(raw)
}

export function resolveFeatureLabel(
  properties: Record<string, unknown>,
  id: number,
  fallbackLabel?: string
): string {
  return getFeatureLabel(properties, id, fallbackLabel)
}

export function getRegionIdFromMapFeature(feature: unknown): number | undefined {
  if (!feature || typeof feature !== 'object') return undefined
  if ('getProperties' in feature && typeof feature.getProperties === 'function') {
    const props = (feature as { getProperties: () => Record<string, unknown> }).getProperties()
    const regionId = props.region_id
    return typeof regionId === 'number' ? regionId : undefined
  }
  if ('properties' in feature) {
    const props = (feature as TerritoryMapFeature).properties
    const regionId = props.region_id
    return typeof regionId === 'number' ? regionId : undefined
  }
  return undefined
}

export function toTerritoryMapFeature(
  id: number,
  properties: Record<string, unknown>,
  geometry: object,
  fallbackLabel?: string
): TerritoryMapFeature {
  return {
    id,
    label: resolveFeatureLabel(properties, id, fallbackLabel),
    properties,
    geometry,
  }
}
