/**
 * GeoJSON types used by territory APIs and map.
 * Shared contract so api and shared do not depend on each other.
 */
export type GeoJSONFeatureCollection = {
  type: 'FeatureCollection'
  features: Array<{
    type: 'Feature'
    id: number
    properties: Record<string, unknown>
    geometry: object
  }>
}
