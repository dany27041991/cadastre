/**
 * Small GeoJSON FeatureCollection helpers used by territory navigation.
 */
export function hasGeoJsonFeatures(geojson: { features?: unknown[] }): boolean {
  return Boolean(geojson.features?.length)
}

export function geoJsonHasFeatureId(
  geojson: { features?: Array<{ id?: number; properties?: { id?: number } }> },
  featureId: number
): boolean {
  return Boolean(
    geojson.features?.some(
      (f) => f.id === featureId || f.properties?.id === featureId
    )
  )
}
