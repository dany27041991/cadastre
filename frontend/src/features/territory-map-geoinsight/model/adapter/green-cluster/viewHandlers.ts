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
    // #region agent log
    fetch('http://127.0.0.1:7455/ingest/ee4d7135-3aef-4e11-b07a-3de89c3bf62c',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'4fe799'},body:JSON.stringify({sessionId:'4fe799',runId:'fit-suppress',hypothesisId:'H-fit-storm',location:'viewHandlers:zoom',message:'fit_suppress_skip',data:{zoom,kind:'zoom'},timestamp:Date.now()})}).catch(()=>{})
    // #endregion
    return
  }
  // One in-flight viewport at a time (debug 4fe799: NetworkError / DuckDB pile-up).
  if (isViewportLoadBurstActive()) {
    // #region agent log
    fetch('http://127.0.0.1:7455/ingest/ee4d7135-3aef-4e11-b07a-3de89c3bf62c',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'4fe799'},body:JSON.stringify({sessionId:'4fe799',runId:'pool-storm',hypothesisId:'H-burst',location:'viewHandlers:zoom',message:'camera_burst_skip',data:{zoom,kind:'zoom'},timestamp:Date.now()})}).catch(()=>{})
    // #endregion
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
  // #region agent log
  fetch('http://127.0.0.1:7455/ingest/ee4d7135-3aef-4e11-b07a-3de89c3bf62c',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'4fe799'},body:JSON.stringify({sessionId:'4fe799',runId:'cerca-no-cam',hypothesisId:'H-camera',location:'viewHandlers:zoom',message:'camera_zoom_schedule',data:{zoom,lastApplied:host.lastAppliedGreenAssetZoom},timestamp:Date.now()})}).catch(()=>{})
  // #endregion
  scheduleRawClusterApply(host, APPLY_REASON.rawZoomChange)
}

export function onGreenAssetMapViewChange(host: GeoinsightGreenClusterHost): void {
  if (!host.greenAssetClusteringActive || host.greenViewportFetcher == null) return
  if (isProgrammaticFitSuppressActive()) {
    // #region agent log
    fetch('http://127.0.0.1:7455/ingest/ee4d7135-3aef-4e11-b07a-3de89c3bf62c',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'4fe799'},body:JSON.stringify({sessionId:'4fe799',runId:'fit-suppress',hypothesisId:'H-fit-storm',location:'viewHandlers:pan',message:'fit_suppress_skip',data:{kind:'pan'},timestamp:Date.now()})}).catch(()=>{})
    // #endregion
    return
  }
  if (isViewportLoadBurstActive()) {
    // #region agent log
    fetch('http://127.0.0.1:7455/ingest/ee4d7135-3aef-4e11-b07a-3de89c3bf62c',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'4fe799'},body:JSON.stringify({sessionId:'4fe799',runId:'pool-storm',hypothesisId:'H-burst',location:'viewHandlers:pan',message:'camera_burst_skip',data:{kind:'pan'},timestamp:Date.now()})}).catch(()=>{})
    // #endregion
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

  // #region agent log
  fetch('http://127.0.0.1:7455/ingest/ee4d7135-3aef-4e11-b07a-3de89c3bf62c',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'4fe799'},body:JSON.stringify({sessionId:'4fe799',runId:'cerca-no-cam',hypothesisId:'H-camera',location:'viewHandlers:pan',message:'camera_pan_schedule',data:{bbox,lastBbox:host.lastAppliedViewportBbox,zoomLast:host.lastAppliedGreenAssetZoom},timestamp:Date.now()})}).catch(()=>{})
  // #endregion
  scheduleRawClusterApply(host, APPLY_REASON.panViewport)
}
