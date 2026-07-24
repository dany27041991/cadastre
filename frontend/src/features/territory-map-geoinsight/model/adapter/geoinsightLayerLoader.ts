import type { GeoJSONFeatureCollection } from '@/shared/types'
import { resolveFeatureId } from '@/features/territory/lib/featureIdentity'
import {
  geoJsonToGeoinsightGeometries,
  type GeoinsightGeometryClip,
} from '@/features/territory/lib/geoJsonToGeoinsight'
import type { GeometryLayerKind } from '../geometryRegistry'
import type { GeoinsightAdapterHost } from './geoinsightAdapterHost'

export function loadLayerFromGeoJson(
  host: GeoinsightAdapterHost,
  geojson: GeoJSONFeatureCollection,
  prefix: string,
  layerKind: GeometryLayerKind,
  color: string | [number, number, number, number],
  replacePrefixes: string[]
): GeoinsightGeometryClip[] {
  for (const p of replacePrefixes) {
    const removed = host.registry.removeByPrefix(p)
    host.removeGeomIds(removed)
  }

  const { geometries, metas } = geoJsonToGeoinsightGeometries(geojson, prefix, { color })
  for (const meta of metas) {
    const source = geojson.features?.find(
      (f) => resolveFeatureId(f.properties ?? {}, f.id) === meta.id
    )
    host.registry.register({
      id: meta.id,
      label: meta.label,
      geomId: meta.geomId,
      layerKind,
      bbox: meta.bbox,
      properties: source?.properties ?? {},
      geometry: source?.geometry ?? {},
    })
  }
  if (layerKind === 'territory') {
    host.lastTerritoryGeometries = geometries
  }
  host.addGeometries(geometries)
  return geometries
}
