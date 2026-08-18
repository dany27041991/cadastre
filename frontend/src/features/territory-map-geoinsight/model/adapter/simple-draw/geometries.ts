import { geoinsightConfig } from '@/app/config/geoinsight'
import { MAP_TRIGGER, SIMPLE_DRAW_CONTROL_ID } from './constants'
import { clearKeepSimpleDrawClipFeatures } from './clipKeepGuard'
import { simpleDrawFeatureId } from './layerOps'
import { getMapWidgetProxy, triggerSimpleDraw } from './mapWidgetHost'

export function clearGeoinsightSimpleDrawGeometries(): void {
  clearKeepSimpleDrawClipFeatures()
  const mapId = geoinsightConfig.mapId
  triggerSimpleDraw(MAP_TRIGGER.clearDrawnGeometries, mapId, SIMPLE_DRAW_CONTROL_ID)
  triggerSimpleDraw(MAP_TRIGGER.deactivateDrawGeometry, mapId, SIMPLE_DRAW_CONTROL_ID)
}

/** Leave drawn features on the map; only stop the active simpledraw tool. */
export function deactivateGeoinsightSimpleDrawTool(): void {
  triggerSimpleDraw(MAP_TRIGGER.deactivateDrawGeometry, geoinsightConfig.mapId, SIMPLE_DRAW_CONTROL_ID)
}

function newestFeatureId(withIds: Array<{ id: unknown }>): { id: unknown } {
  return withIds.reduce((best, row) => {
    const a = Number.parseInt(String(best.id), 10)
    const b = Number.parseInt(String(row.id), 10)
    if (Number.isFinite(b) && (!Number.isFinite(a) || b >= a)) return row
    return best
  })
}

/** Keep newest simpledraw feature so a new closed shape replaces the previous clip. */
export function keepOnlyLastGeoinsightSimpleDrawGeometry(): {
  kept: number
  removed: number
  keepId: unknown
} {
  const proxy = getMapWidgetProxy()
  const mapId = geoinsightConfig.mapId
  const features = triggerSimpleDraw(MAP_TRIGGER.getDrawnFeatures, mapId, SIMPLE_DRAW_CONTROL_ID)
  if (!Array.isArray(features) || features.length <= 1) {
    return { kept: Array.isArray(features) ? features.length : 0, removed: 0, keepId: null }
  }
  const withIds = features
    .map((feature) => ({ id: simpleDrawFeatureId(feature) }))
    .filter((row) => row.id != null)
  if (withIds.length === 0) {
    return { kept: features.length, removed: 0, keepId: null }
  }
  const keep = newestFeatureId(withIds)
  const removeIds = withIds.filter((row) => row.id !== keep.id).map((row) => row.id)
  if (removeIds.length > 0) {
    proxy?.$trigger?.(MAP_TRIGGER.clearDrawnGeometriesByIds, [
      mapId,
      SIMPLE_DRAW_CONTROL_ID,
      removeIds,
    ])
  }
  return { kept: 1, removed: removeIds.length, keepId: keep.id }
}
