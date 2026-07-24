/**
 * Engine-agnostic map feature (Geoinsight).
 */
export interface TerritoryMapFeature {
  id: number
  label: string
  properties: Record<string, unknown>
  geometry: object
}
