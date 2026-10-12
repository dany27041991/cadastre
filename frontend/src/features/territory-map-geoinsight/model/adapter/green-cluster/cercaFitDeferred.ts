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

export function cancelDeferredCercaFit(reason = 'cancel'): void {
  if (deferredTimer != null) {
    clearTimeout(deferredTimer)
    deferredTimer = null
  }
  deferredHost = null
  deferredFitFn = null
  // #region agent log
  fetch('http://127.0.0.1:7455/ingest/ee4d7135-3aef-4e11-b07a-3de89c3bf62c',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'4fe799'},body:JSON.stringify({sessionId:'4fe799',runId:'fit-defer',hypothesisId:'H-fit-defer',location:'cercaFitDeferred:cancel',message:'cerca_fit_defer_cancel',data:{reason},timestamp:Date.now()})}).catch(()=>{})
  // #endregion
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
  // #region agent log
  fetch('http://127.0.0.1:7455/ingest/ee4d7135-3aef-4e11-b07a-3de89c3bf62c',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'4fe799'},body:JSON.stringify({sessionId:'4fe799',runId:'fit-defer',hypothesisId:'H-fit-defer',location:'cercaFitDeferred:schedule',message:'cerca_fit_defer_schedule',data:{waitMs},timestamp:Date.now()})}).catch(()=>{})
  // #endregion
  deferredTimer = setTimeout(() => {
    deferredTimer = null
    const h = deferredHost
    const fn = deferredFitFn
    deferredHost = null
    deferredFitFn = null
    if (h == null || fn == null) return
    // #region agent log
    fetch('http://127.0.0.1:7455/ingest/ee4d7135-3aef-4e11-b07a-3de89c3bf62c',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'4fe799'},body:JSON.stringify({sessionId:'4fe799',runId:'fit-defer',hypothesisId:'H-fit-defer',location:'cercaFitDeferred:timeout',message:'cerca_fit_defer_fire',data:{why:'timeout'},timestamp:Date.now()})}).catch(()=>{})
    // #endregion
    fn(h)
  }, waitMs)
}

/** Fire deferred fit now (assets arrived). */
export function flushDeferredCercaFit(why = 'assets'): boolean {
  const h = deferredHost
  const fn = deferredFitFn
  if (h == null || fn == null) return false
  if (deferredTimer != null) {
    clearTimeout(deferredTimer)
    deferredTimer = null
  }
  deferredHost = null
  deferredFitFn = null
  // #region agent log
  fetch('http://127.0.0.1:7455/ingest/ee4d7135-3aef-4e11-b07a-3de89c3bf62c',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'4fe799'},body:JSON.stringify({sessionId:'4fe799',runId:'fit-defer',hypothesisId:'H-fit-defer',location:'cercaFitDeferred:flush',message:'cerca_fit_defer_fire',data:{why},timestamp:Date.now()})}).catch(()=>{})
  // #endregion
  fn(h)
  return true
}
