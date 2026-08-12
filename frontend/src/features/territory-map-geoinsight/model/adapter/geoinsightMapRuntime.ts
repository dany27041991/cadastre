import type { GeoinsightRef } from '@mase/commons-geoinsight'
import { geoinsightConfig } from '@/app/config/geoinsight'
import { useGeoinsightStore } from '@/app/store/useGeoinsightStore'
import type { GeoinsightGeometryClip } from '@/features/territory/lib/geoJsonToGeoinsight'

type PendingOp = () => void

export interface GeoinsightMapRuntimeHost {
  readonly pending: PendingOp[]
  activateDrawnGeometryInfo(): void
}

export function getGeoinsightRef(): GeoinsightRef | null | undefined {
  return useGeoinsightStore.getState().geoinsightRef?.current
}

export function getGeoinsightMapId(): number {
  return geoinsightConfig.mapId
}

export function flushGeoinsightPending(host: GeoinsightMapRuntimeHost): void {
  if (!useGeoinsightStore.getState().isMapReady || !getGeoinsightRef()) return
  const ops = [...host.pending]
  host.pending.length = 0
  for (const op of ops) op()
}

export function runGeoinsightOrQueue(host: GeoinsightMapRuntimeHost, op: PendingOp): void {
  if (useGeoinsightStore.getState().isMapReady && getGeoinsightRef()) {
    op()
    return
  }
  host.pending.push(op)
}

/**
 * Vendor add/remove blocks the main thread ~0.08ms per geometry in a single call
 * (debug logs: REMOVE n=1700 = 157ms, ADD n=1611 = 128ms). Large batches are split
 * into chunks drained one per animation frame through a FIFO queue, so op ordering
 * is preserved while the single block stays short. 500-geometry chunks still
 * blocked up to 122ms under load (debug logs), so the chunk is halved.
 *
 * Removes use a much larger chunk: measured cost is ~4ms per 250 ids (debug logs,
 * removeMs max 5ms), while spreading them across rAF frames stretched zoom
 * transitions to ~750ms (7 frames at ~120ms under render load) with mixed
 * old+new geometries visible in between.
 *
 * Adds also use a large chunk: every addGeometries call makes the vendor
 * reprocess its layer, so a dense pan cycle split into 4x250 calls multiplied
 * that churn and fed the Firefox GC pauses behind the pan freezes. One
 * 1000-geometry call blocks ~80ms once instead.
 */
const VENDOR_OP_CHUNK = 1000
const VENDOR_REMOVE_OP_CHUNK = 2000
const vendorOpQueue: PendingOp[] = []
let vendorOpDraining = false

function enqueueVendorOps(ops: PendingOp[]): void {
  vendorOpQueue.push(...ops)
  if (vendorOpDraining) return
  vendorOpDraining = true
  const drain = (): void => {
    const next = vendorOpQueue.shift()
    if (next) next()
    if (vendorOpQueue.length > 0) {
      requestAnimationFrame(drain)
      return
    }
    vendorOpDraining = false
  }
  drain()
}

function chunkItems<T>(items: T[], size: number): T[][] {
  if (items.length <= size) return [items]
  const chunks: T[][] = []
  for (let i = 0; i < items.length; i += size) chunks.push(items.slice(i, i + size))
  return chunks
}

export function removeGeoinsightGeomIds(ids: string[], host: GeoinsightMapRuntimeHost): void {
  if (ids.length === 0) return
  runGeoinsightOrQueue(host, () => {
    const chunks = chunkItems(ids, VENDOR_REMOVE_OP_CHUNK)
    enqueueVendorOps(
      chunks.map((part, index) => () => {
        getGeoinsightRef()?.removeGeometries?.(getGeoinsightMapId(), part)
        // Diff mounts run adds before removes, so removes are the last vendor op:
        // the vendor drops the drawn-geometry click subscription on remove and
        // cluster clicks stopped firing (debug logs: zero pick events after green
        // mounts while territory clicks kept working). Re-activate after the batch.
        if (index === chunks.length - 1) {
          host.activateDrawnGeometryInfo()
        }
      })
    )
  })
}

export function addGeoinsightGeometries(
  host: GeoinsightMapRuntimeHost,
  geometries: GeoinsightGeometryClip[],
  options?: { showLabels?: boolean }
): void {
  if (geometries.length === 0) return
  runGeoinsightOrQueue(host, () => {
    const chunks = chunkItems(geometries, VENDOR_OP_CHUNK)
    enqueueVendorOps(
      chunks.map((part, index) => () => {
        const ref = getGeoinsightRef()
        const mapId = getGeoinsightMapId()
        ref?.addGeometries?.(mapId, part)
        if (index === chunks.length - 1) {
          // Only green mounts pass showLabels explicitly. Territory/other
          // addGeometries calls used to default to false and clobber cluster
          // count visibility after a later territory remount.
          if (options?.showLabels !== undefined) {
            ref?.setGeometryLabelVisibility?.(mapId, options.showLabels)
          }
          host.activateDrawnGeometryInfo()
        }
      })
    )
  })
}

/**
 * Runs `callback` after every vendor op queued so far has been executed.
 * The vendor op queue is FIFO and drained across animation frames, so a
 * sentinel op marks the end of the heavy mount phase (used to keep the
 * green-layer loading indicator up while the vendor processes geometries).
 */
export function runAfterGeoinsightVendorOps(
  host: GeoinsightMapRuntimeHost,
  callback: () => void
): void {
  runGeoinsightOrQueue(host, () => {
    enqueueVendorOps([callback])
  })
}

export function activateGeoinsightDrawnGeometryInfo(host: GeoinsightMapRuntimeHost): void {
  runGeoinsightOrQueue(host, () => {
    const ref = getGeoinsightRef()
    const mapId = getGeoinsightMapId()
    if (!ref?.activateDrawnGeometryInfo) return
    ref.deactivateDrawnGeometryInfo?.(mapId)
    ref.activateDrawnGeometryInfo(mapId)
  })
}
