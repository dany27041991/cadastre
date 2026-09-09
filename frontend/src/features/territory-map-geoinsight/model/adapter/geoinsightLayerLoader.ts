import type { GeoJSONFeatureCollection } from '@/shared/types'
import { resolveFeatureId } from '@/features/territory/lib/featureIdentity'
import {
  buildGreenAreaGeomId,
  municipalityIdFromProperties,
} from '@/features/territory/lib/greenAreaGeomId'
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

  const { geometries, metas } = geoJsonToGeoinsightGeometries(geojson, prefix, {
    color,
    ...(layerKind === 'green_area'
      ? {
          geomIdForFeature: (properties: Record<string, unknown>, id: number) =>
            buildGreenAreaGeomId(id, municipalityIdFromProperties(properties)),
        }
      : {}),
  })
  for (const meta of metas) {
    const source = geojson.features?.find((f) => {
      const props = (f.properties ?? {}) as Record<string, unknown>
      const fid = resolveFeatureId(props, f.id)
      if (layerKind !== 'green_area') return fid === meta.id
      return (
        fid === meta.id &&
        buildGreenAreaGeomId(fid, municipalityIdFromProperties(props)) === meta.geomId
      )
    })
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
