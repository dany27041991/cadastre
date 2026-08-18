import { useGeoinsightStore } from '@/app/store/useGeoinsightStore'
import { getGeoinsightRef } from './ref'
import type { GeoinsightMapRuntimeHost, PendingOp } from './types'

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
