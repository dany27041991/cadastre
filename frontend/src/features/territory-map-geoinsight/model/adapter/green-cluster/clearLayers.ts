import { GEOM_PREFIX } from '../../constants'
import { CLUSTER_ID_ZWSP, LAYER_KIND } from './constants'
import type { GeoinsightGreenClusterHost } from './types'

export function clearGreenLayerPrefixes(host: GeoinsightGreenClusterHost): string[] {
  const clipIds = host.lastGreenGeometries.map((geometry) => geometry.geom_id)
  const ids = [
    ...new Set([
      ...clipIds,
      ...host.registry.removeByPrefix(GEOM_PREFIX.greenArea),
      ...host.registry.removeByPrefix(GEOM_PREFIX.greenAsset),
      ...host.registry.removeByLayerKind(LAYER_KIND.cluster),
    ]),
  ]
  host.removeGeomIds(ids)
  return ids
}

function isAssetOrClusterGeomId(id: string): boolean {
  return (
    id.startsWith(GEOM_PREFIX.greenAsset) ||
    id.startsWith(GEOM_PREFIX.cluster) ||
    id.includes(`${CLUSTER_ID_ZWSP}${GEOM_PREFIX.cluster}`) ||
    id.includes(GEOM_PREFIX.cluster)
  )
}

/** Drop asset points / clusters only — keep GA_ polygons mounted across zoom. */
export function clearAssetAndClusterLayerPrefixes(host: GeoinsightGreenClusterHost): string[] {
  const assetOrClusterIds = host.lastGreenGeometries
    .map((geometry) => geometry.geom_id)
    .filter(isAssetOrClusterGeomId)
  const ids = [
    ...new Set([
      ...assetOrClusterIds,
      ...host.registry.removeByPrefix(GEOM_PREFIX.greenAsset),
      ...host.registry.removeByLayerKind(LAYER_KIND.cluster),
    ]),
  ]
  host.lastGreenGeometries = host.lastGreenGeometries.filter((geometry) =>
    geometry.geom_id.startsWith(GEOM_PREFIX.greenArea)
  )
  host.removeGeomIds(ids)
  return ids
}
