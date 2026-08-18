import {
  APPLY_REASON,
  RAW_CLUSTER_APPLY_DEBOUNCE_MS,
  RAW_ZOOM_APPLY_DEBOUNCE_MS,
} from './constants'
import { deferApplyUntilPointerRelease, isMapPointerDragActive } from './dragDefer'
import { cancelPanStalePrune } from './panStalePrune'
import { readCurrentGreenClusterZoom, refreshGreenViewport } from './refreshViewport'
import type { GeoinsightGreenClusterHost } from './types'

const rawApplyTimers = new WeakMap<
  GeoinsightGreenClusterHost,
  ReturnType<typeof setTimeout>
>()
const rawApplyReasons = new WeakMap<GeoinsightGreenClusterHost, string>()

export function cancelRawClusterApply(host: GeoinsightGreenClusterHost): void {
  const rawPending = rawApplyTimers.get(host)
  if (rawPending != null) clearTimeout(rawPending)
  rawApplyTimers.delete(host)
  rawApplyReasons.delete(host)
}

export function scheduleRawClusterApply(host: GeoinsightGreenClusterHost, reason: string): void {
  const pending = rawApplyTimers.get(host)
  const pendingReason = rawApplyReasons.get(host)
  // A pan bump must not cancel an in-flight zoom settle: zoom-out keeps the
  // map center fixed, so the pan path often no-ops after cancelling the zoom
  // timer — clusters would never recalc on the Geoinsight +/- buttons.
  if (
    pending != null &&
    pendingReason === APPLY_REASON.rawZoomChange &&
    reason !== APPLY_REASON.rawZoomChange
  ) {
    return
  }
  const effectiveReason =
    pendingReason === APPLY_REASON.rawZoomChange || reason === APPLY_REASON.rawZoomChange
      ? APPLY_REASON.rawZoomChange
      : reason
  const debounceMs =
    effectiveReason === APPLY_REASON.rawZoomChange
      ? RAW_ZOOM_APPLY_DEBOUNCE_MS
      : RAW_CLUSTER_APPLY_DEBOUNCE_MS
  if (pending != null) clearTimeout(pending)
  rawApplyReasons.set(host, effectiveReason)
  rawApplyTimers.set(
    host,
    setTimeout(() => {
      rawApplyTimers.delete(host)
      rawApplyReasons.delete(host)
      const run = () => {
        if (!host.greenAssetClusteringActive) return
        // Re-read the zoom at execution time: the view-change and zoom-change
        // paths share this timer, so a pan bump fired during a zoom animation
        // could execute with the zoom captured mid-animation and mount the
        // wrong display level.
        void refreshGreenViewport(host, readCurrentGreenClusterZoom(), effectiveReason)
      }
      if (isMapPointerDragActive()) {
        // Coalesce: only the latest apply survives; it runs on pointer release.
        deferApplyUntilPointerRelease(run)
        return
      }
      run()
    }, debounceMs)
  )
}

export function resetGreenAssetClusterState(host: GeoinsightGreenClusterHost): void {
  host.greenAssetClusteringActive = false
  host.lastAppliedGreenAssetZoom = null
  host.lastGreenGeometries = []
  host.lastGreenShowClusterCountLabels = false
  host.lastAppliedViewportBbox = null
  host.lastAppliedRawMode = false
  host.greenViewportFetcher = null
  host.greenViewportAreasFetcher = null
  host.greenViewportRequestSeq += 1
  cancelRawClusterApply(host)
  cancelPanStalePrune(host)
}
