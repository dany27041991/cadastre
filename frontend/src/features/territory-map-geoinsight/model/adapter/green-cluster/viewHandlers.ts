import { viewportBboxFromMapStatus, viewportBboxMovedEnough } from '../../../lib/mapViewportBbox'
import { getGeoinsightMapId, getGeoinsightRef } from '../geoinsightMapRuntime'
import { APPLY_REASON, GREEN_ZOOM_JITTER_EPSILON } from './constants'
import { isProgrammaticFitSuppressActive } from './programmaticFitGuard'
import { scheduleRawClusterApply } from './scheduleApply'
import { isViewportLoadBurstActive } from '@/features/territory/model/hooks/viewportLoadGate'
import type { GeoinsightGreenClusterHost } from './types'

export function onGreenAssetMapZoomChange(host: GeoinsightGreenClusterHost, zoom: number): void {
  if (!host.greenAssetClusteringActive || host.greenViewportFetcher == null) {
    return
  }
  // Cerca fit animation must not spawn a zoom-storm of viewport fetches.
  if (isProgrammaticFitSuppressActive()) {
    return
  }
  // One in-flight viewport at a time (debug 4fe799: NetworkError / DuckDB pile-up).
  if (isViewportLoadBurstActive()) {
    return
  }
  // Server viewport mode: every settled zoom step refetches; the jitter guard
  // absorbs the vendor's fractional zoom during animations.
  if (
    host.lastAppliedGreenAssetZoom != null &&
    Math.abs(zoom - host.lastAppliedGreenAssetZoom) < GREEN_ZOOM_JITTER_EPSILON
  ) {
    return
  }
  scheduleRawClusterApply(host, APPLY_REASON.rawZoomChange)
}

export function onGreenAssetMapViewChange(host: GeoinsightGreenClusterHost): void {
  if (!host.greenAssetClusteringActive || host.greenViewportFetcher == null) return
  if (isProgrammaticFitSuppressActive()) {
    return
  }
  if (isViewportLoadBurstActive()) {
    return
  }

  const mapStatus = getGeoinsightRef()?.getCenterAndScale?.(getGeoinsightMapId())
  const bbox = viewportBboxFromMapStatus(mapStatus)
  if (bbox == null) return

  if (
    host.lastAppliedViewportBbox != null &&
    !viewportBboxMovedEnough(host.lastAppliedViewportBbox, bbox)
  ) {
    return
  }

  scheduleRawClusterApply(host, APPLY_REASON.panViewport)
}
