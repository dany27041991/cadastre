/**
 * Defer Cerca camera fit until clusters are mounted (or timeout).
 * Fitting on areas-only at ~7s then waiting for assets caused a jump without
 * clusters; soft-stale z6 clusters arrived later (debug 4fe799).
 */

import type { GeoinsightGreenClusterHost } from './types'

/** Wait for in-flight assets before framing areas after Cerca. */
export const CERCA_FIT_ASSETS_WAIT_MS = 10000

let deferredTimer: ReturnType<typeof setTimeout> | null = null
let deferredHost: GeoinsightGreenClusterHost | null = null
let deferredFitFn: ((host: GeoinsightGreenClusterHost) => void) | null = null

export function cancelDeferredCercaFit(_reason = 'cancel'): void {
  if (deferredTimer != null) {
    clearTimeout(deferredTimer)
    deferredTimer = null
  }
  deferredHost = null
  deferredFitFn = null
}

export function hasDeferredCercaFit(): boolean {
  return deferredFitFn != null
}

/** Arm a one-shot fit: fires on flushDeferredCercaFit or after waitMs. */
export function scheduleDeferredCercaFit(
  host: GeoinsightGreenClusterHost,
  fitFn: (host: GeoinsightGreenClusterHost) => void,
  waitMs = CERCA_FIT_ASSETS_WAIT_MS,
): void {
  cancelDeferredCercaFit('reschedule')
  deferredHost = host
  deferredFitFn = fitFn
  deferredTimer = setTimeout(() => {
    deferredTimer = null
    const h = deferredHost
    const fn = deferredFitFn
    deferredHost = null
    deferredFitFn = null
    if (h == null || fn == null) return
    fn(h)
  }, waitMs)
}

/** Fire deferred fit now (assets arrived). */
export function flushDeferredCercaFit(_why = 'assets'): boolean {
  const h = deferredHost
  const fn = deferredFitFn
  if (h == null || fn == null) return false
  if (deferredTimer != null) {
    clearTimeout(deferredTimer)
    deferredTimer = null
  }
  deferredHost = null
  deferredFitFn = null
  fn(h)
  return true
}
