import {
  PAN_STALE_FORCE_DROP_MAX,
  PAN_STALE_FORCE_PRUNE_AT,
  PAN_STALE_PRUNE_BATCH,
  PAN_STALE_PRUNE_IDLE_MS,
  PAN_STALE_PRUNE_MIN,
  PAN_STALE_PRUNE_REPEAT_MS,
} from './constants'
import { isMapPointerDragActive } from './dragDefer'
import type { GeoinsightGreenClusterHost } from './types'

const panStalePruneTimers = new WeakMap<
  GeoinsightGreenClusterHost,
  ReturnType<typeof setTimeout>
>()
const panCurrentViewportIds = new WeakMap<GeoinsightGreenClusterHost, Set<string>>()

export function cancelPanStalePrune(host: GeoinsightGreenClusterHost): void {
  const pending = panStalePruneTimers.get(host)
  if (pending != null) clearTimeout(pending)
  panStalePruneTimers.delete(host)
}

export function setPanCurrentViewportIds(
  host: GeoinsightGreenClusterHost,
  ids: Set<string>
): void {
  panCurrentViewportIds.set(host, ids)
}

function prunePanStaleGeometries(host: GeoinsightGreenClusterHost): void {
  const currentIds = panCurrentViewportIds.get(host)
  if (currentIds == null) return
  const stale = host.lastGreenGeometries.filter((g) => !currentIds.has(g.geom_id))
  // Small stale sets stay mounted: an offscreen leftover is harmless, while
  // every removal batch risks a GC pause. Zoom/mode changes full-replace anyway.
  if (stale.length < PAN_STALE_PRUNE_MIN) return
  const batch = stale.slice(0, PAN_STALE_PRUNE_BATCH)
  const batchIds = new Set(batch.map((g) => g.geom_id))
  for (const id of batchIds) host.registry.removeByGeomId(id)
  host.lastGreenGeometries = host.lastGreenGeometries.filter((g) => !batchIds.has(g.geom_id))
  host.removeGeomIds([...batchIds])
  if (stale.length - batch.length >= PAN_STALE_PRUNE_MIN) {
    schedulePanStalePrune(host, PAN_STALE_PRUNE_REPEAT_MS)
  }
}

export function schedulePanStalePrune(
  host: GeoinsightGreenClusterHost,
  delayMs: number = PAN_STALE_PRUNE_IDLE_MS
): void {
  cancelPanStalePrune(host)
  panStalePruneTimers.set(
    host,
    setTimeout(() => {
      panStalePruneTimers.delete(host)
      if (!host.greenAssetClusteringActive) return
      if (isMapPointerDragActive()) {
        schedulePanStalePrune(host)
        return
      }
      prunePanStaleGeometries(host)
    }, delayMs)
  )
}

/** How many stale features to drop inline during additive pan (overflow budget). */
export function panStaleInlineDropCount(staleLength: number): number {
  if (staleLength <= PAN_STALE_FORCE_PRUNE_AT) return 0
  return Math.min(
    staleLength - PAN_STALE_FORCE_PRUNE_AT + PAN_STALE_PRUNE_BATCH,
    PAN_STALE_FORCE_DROP_MAX
  )
}
