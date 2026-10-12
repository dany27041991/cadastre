/**
 * Coalesce Cerca/viewport-load: abort prior HTTP and block zoom/pan/table
 * until the load ends — prevents DuckDB/MinIO pile-up (debug 4fe799 NetworkError).
 *
 * Burst is boolean (not a stack): arming at cerca_commit then again in
 * refreshGreenViewport must not leave depth>0 forever after a single end.
 */

let burstActive = false
/** Extra wall-clock hold after empty-skip / empty-retry so table/zoom stay out. */
let burstHoldUntil = 0
/** Areas already on map: table may hit DuckDB while assets still load. */
let tableMayFetch = false
let abortCtrl: AbortController | null = null

export function beginViewportLoadBurst(reason: string): AbortSignal {
  if (abortCtrl != null) {
    abortCtrl.abort()
    // #region agent log
    fetch('http://127.0.0.1:7455/ingest/ee4d7135-3aef-4e11-b07a-3de89c3bf62c',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'4fe799'},body:JSON.stringify({sessionId:'4fe799',runId:'post-fix',hypothesisId:'H-abort',location:'viewportLoadGate:begin',message:'viewport_abort_prev',data:{reason,burstActive,holdLeftMs:Math.max(0,burstHoldUntil-Date.now())},timestamp:Date.now()})}).catch(()=>{})
    // #endregion
  }
  abortCtrl = new AbortController()
  burstActive = true
  tableMayFetch = false
  // #region agent log
  fetch('http://127.0.0.1:7455/ingest/ee4d7135-3aef-4e11-b07a-3de89c3bf62c',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'4fe799'},body:JSON.stringify({sessionId:'4fe799',runId:'post-fix',hypothesisId:'H-burst',location:'viewportLoadGate:begin',message:'viewport_burst_begin',data:{reason,burstActive:true},timestamp:Date.now()})}).catch(()=>{})
  // #endregion
  return abortCtrl.signal
}

export function endViewportLoadBurst(reason: string): void {
  burstActive = false
  tableMayFetch = true
  // #region agent log
  fetch('http://127.0.0.1:7455/ingest/ee4d7135-3aef-4e11-b07a-3de89c3bf62c',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'4fe799'},body:JSON.stringify({sessionId:'4fe799',runId:'post-fix',hypothesisId:'H-burst',location:'viewportLoadGate:end',message:'viewport_burst_end',data:{reason,burstActive:false,holdLeftMs:Math.max(0,burstHoldUntil-Date.now())},timestamp:Date.now()})}).catch(()=>{})
  // #endregion
}

/** Keep table/zoom blocked while MinIO recovers (debug 4fe799 2nd Cerca). */
export function holdViewportBurstMs(ms: number, reason: string): void {
  burstHoldUntil = Math.max(burstHoldUntil, Date.now() + ms)
  // #region agent log
  fetch('http://127.0.0.1:7455/ingest/ee4d7135-3aef-4e11-b07a-3de89c3bf62c',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'4fe799'},body:JSON.stringify({sessionId:'4fe799',runId:'post-fix',hypothesisId:'H-minio-race',location:'viewportLoadGate:hold',message:'viewport_burst_hold',data:{reason,ms,until:burstHoldUntil},timestamp:Date.now()})}).catch(()=>{})
  // #endregion
}

export function isViewportLoadBurstActive(): boolean {
  return burstActive || Date.now() < burstHoldUntil
}

/** Table wait: zoom/pan stay blocked, table can start after areas-early. */
export function markAreasReadyForTable(reason: string): void {
  tableMayFetch = true
  // #region agent log
  fetch('http://127.0.0.1:7455/ingest/ee4d7135-3aef-4e11-b07a-3de89c3bf62c',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'4fe799'},body:JSON.stringify({sessionId:'4fe799',runId:'post-fix',hypothesisId:'H-table-early',location:'viewportLoadGate:areasReady',message:'table_gate_open',data:{reason},timestamp:Date.now()})}).catch(()=>{})
  // #endregion
}

export function isTableFetchBlocked(): boolean {
  if (Date.now() < burstHoldUntil && !tableMayFetch) return true
  return burstActive && !tableMayFetch
}

export function currentViewportAbortSignal(): AbortSignal | undefined {
  return abortCtrl?.signal
}
