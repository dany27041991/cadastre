/**
 * Global GeoJSON contract (used by territory and other features).
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
