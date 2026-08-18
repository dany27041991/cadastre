import { viewportBboxFromMapStatus, viewportBboxMovedEnough } from '../../../lib/mapViewportBbox'
import { getGeoinsightMapId, getGeoinsightRef } from '../geoinsightMapRuntime'
import { APPLY_REASON, GREEN_ZOOM_JITTER_EPSILON } from './constants'
import { scheduleRawClusterApply } from './scheduleApply'
import type { GeoinsightGreenClusterHost } from './types'

export function onGreenAssetMapZoomChange(host: GeoinsightGreenClusterHost, zoom: number): void {
  if (!host.greenAssetClusteringActive || host.greenViewportFetcher == null) {
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
