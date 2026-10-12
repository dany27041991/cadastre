/**
 * Gate for one-shot camera fit after Cerca (attribute filters).
 * Zoom/pan must never arm this — that caused directional map jumps
 * (debug 4fe799: fit on raw-zoom-change:areas-early).
 */
let pendingFilterFit = false

export function armFilterFit(reason = 'cerca'): void {
  pendingFilterFit = true
  // #region agent log
  fetch('http://127.0.0.1:7455/ingest/ee4d7135-3aef-4e11-b07a-3de89c3bf62c',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'4fe799'},body:JSON.stringify({sessionId:'4fe799',runId:'fit-gate',hypothesisId:'H-fit-zoom',location:'filterFitGate:arm',message:'filter_fit_arm',data:{reason,pending:true},timestamp:Date.now()})}).catch(()=>{})
  // #endregion
}

export function peekFilterFit(): boolean {
  return pendingFilterFit
}

/** Returns true once; clears the arm. */
export function consumeFilterFit(reason = 'fit'): boolean {
  if (!pendingFilterFit) return false
  pendingFilterFit = false
  // #region agent log
  fetch('http://127.0.0.1:7455/ingest/ee4d7135-3aef-4e11-b07a-3de89c3bf62c',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'4fe799'},body:JSON.stringify({sessionId:'4fe799',runId:'fit-gate',hypothesisId:'H-fit-zoom',location:'filterFitGate:consume',message:'filter_fit_consume',data:{reason,pending:false},timestamp:Date.now()})}).catch(()=>{})
  // #endregion
  return true
}

export function clearFilterFit(reason = 'clear'): void {
  if (!pendingFilterFit) return
  pendingFilterFit = false
  // #region agent log
  fetch('http://127.0.0.1:7455/ingest/ee4d7135-3aef-4e11-b07a-3de89c3bf62c',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'4fe799'},body:JSON.stringify({sessionId:'4fe799',runId:'fit-gate',hypothesisId:'H-fit-zoom',location:'filterFitGate:clear',message:'filter_fit_clear',data:{reason},timestamp:Date.now()})}).catch(()=>{})
  // #endregion
}
