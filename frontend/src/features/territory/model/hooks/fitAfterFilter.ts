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
export function cancelScheduledFilterFitTimers(_reason = 'cancel-timers'): void {
  for (const id of activeTimers) window.clearTimeout(id)
  activeTimers = []
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
  const opts = layerKinds ? { layerKinds } : undefined
  for (const delay of FIT_RETRY_DELAYS_MS) {
    activeTimers.push(
      window.setTimeout(() => {
        // areas-early already fitted + cleared the gate — do not yank the camera again.
        if (!peekFilterFit()) {
          return
        }
        fitToGreenExtent(false, opts)
      }, delay),
    )
  }
  return activeTimers[0] ?? 0
}
