/** Green area entity: types for green area (hierarchy, levels). */

export interface GreenAreaFeature {
  type: 'Feature'
  id: number
  properties: Record<string, unknown>
  geometry: object
}

export interface GreenAreaFeatureCollection {
  type: 'FeatureCollection'
  features: GreenAreaFeature[]
}
