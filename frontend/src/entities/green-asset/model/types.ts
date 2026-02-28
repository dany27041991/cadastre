/** Green asset entity: types for trees, rows, lawns, etc. */

export interface GreenAssetFeature {
  type: 'Feature'
  id: number
  properties: Record<string, unknown>
  geometry: object
}

export interface GreenAssetFeatureCollection {
  type: 'FeatureCollection'
  features: GreenAssetFeature[]
}
