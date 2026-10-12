/**
 * Filter sub-municipal GeoJSON by drill level (1, 2, 3).
 */
import type { SubMunicipalDrillLevel } from '@/entities/territory'

export type GeoJSONFeature = {
  type: 'Feature'
  id: number
  properties: Record<string, unknown>
  geometry: object
}

export type GeoJSONFeatureCollection = {
  type: 'FeatureCollection'
  features: GeoJSONFeature[]
}

export function filterSubMunicipalByDrill(
  geojson: GeoJSONFeatureCollection,
  drillLevel: SubMunicipalDrillLevel,
  drillStack: number[]
): GeoJSONFeatureCollection {
  const features = geojson.features ?? []
  let filtered: GeoJSONFeature[]
  if (drillLevel === 1) {
    filtered = features.filter((f) => f.properties?.level === 1)
  } else if (drillLevel === 2 && drillStack.length >= 1) {
    const parentId = drillStack[0]
    filtered = features.filter(
      (f) => f.properties?.parent_id === parentId && f.properties?.level === 2
    )
  } else if (drillLevel === 3 && drillStack.length >= 2) {
    const parentId = drillStack[1]
    filtered = features.filter(
      (f) => f.properties?.parent_id === parentId && f.properties?.level === 3
    )
  } else {
    filtered = features.filter((f) => f.properties?.level === 1)
  }
  return { type: 'FeatureCollection', features: filtered }
}
