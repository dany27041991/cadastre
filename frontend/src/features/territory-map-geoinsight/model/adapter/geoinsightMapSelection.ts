import {
  extractGeomIdFromDrawnFeatures,
  extractGeomIdFromFeatureInfo,
  pickBestGeomIdForGreenDrill,
} from '../eventBridge'
import type { GeoinsightAdapterHost } from './geoinsightAdapterHost'
import { zoomGeoinsightForClusterDrill, zoomGeoinsightToBbox } from './geoinsightMapViewport'

export function syncDrillContext(host: GeoinsightAdapterHost, excludeAreaIds: number[]): void {
  host.drillExcludeAreaIds = excludeAreaIds
}

function resolveClickGeomId(host: GeoinsightAdapterHost, featuresOrEvent: unknown): string | null {
  // Prefer clusters over territory when both are under the click (assets toggle on).
  const pick = pickBestGeomIdForGreenDrill(
    featuresOrEvent,
    {
      resolveGeomId: (geomId) => {
        const entry = host.registry.resolveGeomId(geomId)
        if (!entry) return undefined
        return {
          geomId: entry.geomId,
          id: entry.id,
          layerKind: entry.layerKind,
          bbox: entry.bbox,
        }
      },
      excludeAreaIds: host.drillExcludeAreaIds,
    },
    host.drillExcludeAreaIds
  )
  return pick?.geomId ?? extractGeomIdFromFeatureInfo(featuresOrEvent)
}

export function handleFeatureInfo(
  host: GeoinsightAdapterHost,
  event: unknown,
  selectByGeomId: (geomId: string) => void
): void {
  const geomId = resolveClickGeomId(host, event)
  if (!geomId) return
  selectByGeomId(geomId)
}

export function handleDrawnGeometryInfo(
  host: GeoinsightAdapterHost,
  features: unknown,
  selectByGeomId: (geomId: string) => void
): void {
  const geomId = resolveClickGeomId(host, features) ?? extractGeomIdFromDrawnFeatures(features)
  if (!geomId) return
  selectByGeomId(geomId)
}

export function selectByGeomId(host: GeoinsightAdapterHost, geomId: string): void {
  const entry = host.registry.resolveGeomId(geomId)
  if (!entry) return

  if (entry.isCluster && (entry.memberCount ?? 0) > 1) {
    // Jump past the next aggregation threshold (region→province→municipality→grid→raw).
    // A plain +1.5 / fit on large admin bboxes often stayed in the same zoom band,
    // so the viewport refetch returned identical clusters (no visible explode).
    zoomGeoinsightForClusterDrill(host, entry.bbox)
    return
  }

  if (entry.bbox && (entry.layerKind === 'territory' || entry.layerKind === 'green_area')) {
    zoomGeoinsightToBbox(host, entry.bbox)
  }
  const feature = host.registry.toMapFeature(entry)
  host.onFeatureSelectRef.current(entry.id, entry.label, feature)
}
