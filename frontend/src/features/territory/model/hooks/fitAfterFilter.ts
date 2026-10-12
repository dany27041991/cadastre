/**
 * After Cerca at national zoom, schedule a fit to matching green features.
 */
import { filtersOrUndef, type AppliedFilters } from '../fetchers/greenAssetsViewportFetch'
import { armFilterFit, clearFilterFit, peekFilterFit } from './filterFitGate'

type FitLayerKind = 'green_area' | 'green_asset' | 'cluster'

type FitToGreenExtent = (
  includeTerritoryBbox?: boolean,
  options?: { layerKinds?: ReadonlyArray<FitLayerKind> }
) => void

/** Retries while GA_ mount catches up after Cerca (can take >10s). */
const FIT_RETRY_DELAYS_MS = [800, 2000, 4500, 9000] as const

let activeTimers: number[] = []

export function hasAppliedFilters(
  areaFilters: AppliedFilters,
  assetFilters: AppliedFilters,
): boolean {
  return (
    Object.keys(filtersOrUndef(areaFilters) ?? {}).length > 0 ||
    Object.keys(filtersOrUndef(assetFilters) ?? {}).length > 0
  )
}

/** Clear retry timers only — keep filter-fit gate armed (Cerca deferred fit). */
export function cancelScheduledFilterFitTimers(reason = 'cancel-timers'): void {
  for (const id of activeTimers) window.clearTimeout(id)
  activeTimers = []
  // #region agent log
  fetch('http://127.0.0.1:7455/ingest/ee4d7135-3aef-4e11-b07a-3de89c3bf62c',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'4fe799'},body:JSON.stringify({sessionId:'4fe799',runId:'fit-area',hypothesisId:'H-fit-defer',location:'fitAfterFilter:cancelTimers',message:'fit_timers_cancel',data:{reason},timestamp:Date.now()})}).catch(()=>{})
  // #endregion
}

export function cancelScheduledFilterFits(reason = 'cancel'): void {
  cancelScheduledFilterFitTimers(reason)
  clearFilterFit(reason)
}

/**
 * Arm filter-fit gate + retry fitToGreenExtent until GA_ exist.
 * Does NOT fit on zoom/pan — that is gated in refreshViewport.
 */
export function scheduleFitAfterFilter(
  fitToGreenExtent: FitToGreenExtent,
  areaFilters: AppliedFilters,
  assetFilters: AppliedFilters,
  _delayMs = 1400,
): number {
  cancelScheduledFilterFits('reschedule')
  armFilterFit('scheduleFitAfterFilter')

  const areaKeys = Object.keys(filtersOrUndef(areaFilters) ?? {})
  const assetKeys = Object.keys(filtersOrUndef(assetFilters) ?? {})
  const layerKinds: FitLayerKind[] | undefined =
    areaKeys.length > 0 && assetKeys.length === 0
      ? ['green_area']
      : assetKeys.length > 0 && areaKeys.length === 0
        ? ['green_asset', 'cluster']
        : undefined
  // #region agent log
  fetch('http://127.0.0.1:7455/ingest/ee4d7135-3aef-4e11-b07a-3de89c3bf62c',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'4fe799'},body:JSON.stringify({sessionId:'4fe799',runId:'fit-area',hypothesisId:'H-fit-zoom',location:'fitAfterFilter:schedule',message:'schedule_fit',data:{areaKeys,assetKeys,layerKinds:layerKinds??null,retries:FIT_RETRY_DELAYS_MS.length},timestamp:Date.now()})}).catch(()=>{})
  // #endregion
  const opts = layerKinds ? { layerKinds } : undefined
  for (const delay of FIT_RETRY_DELAYS_MS) {
    activeTimers.push(
      window.setTimeout(() => {
        // areas-early already fitted + cleared the gate — do not yank the camera again.
        if (!peekFilterFit()) {
          // #region agent log
          fetch('http://127.0.0.1:7455/ingest/ee4d7135-3aef-4e11-b07a-3de89c3bf62c',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'4fe799'},body:JSON.stringify({sessionId:'4fe799',runId:'fit-area',hypothesisId:'H-fit-retry',location:'fitAfterFilter:attempt',message:'fit_attempt_skip',data:{delayMs:delay,why:'gate-cleared'},timestamp:Date.now()})}).catch(()=>{})
          // #endregion
          return
        }
        // #region agent log
        fetch('http://127.0.0.1:7455/ingest/ee4d7135-3aef-4e11-b07a-3de89c3bf62c',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'4fe799'},body:JSON.stringify({sessionId:'4fe799',runId:'fit-area',hypothesisId:'H-fit-retry',location:'fitAfterFilter:attempt',message:'fit_attempt',data:{delayMs:delay,layerKinds:layerKinds??null},timestamp:Date.now()})}).catch(()=>{})
        // #endregion
        fitToGreenExtent(false, opts)
      }, delay),
    )
  }
  return activeTimers[0] ?? 0
}
