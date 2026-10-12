/**
 * Blocks zoom/pan viewport refetches while a Cerca camera fit animates.
 * Without this, fit → zoom-storm → seq++ stale-drops the in-flight cluster
 * fetch (debug 4fe799: ga_ids sum=808 then viewport_stale_drop; clusters ~28s).
 */

let suppressUntilMs = 0

/** How long to ignore camera-driven refreshes after programmatic fit. */
export const PROGRAMMATIC_FIT_SUPPRESS_MS = 4500

export function isProgrammaticFitSuppressActive(): boolean {
  return Date.now() < suppressUntilMs
}

export function beginProgrammaticFitSuppress(
  durationMs = PROGRAMMATIC_FIT_SUPPRESS_MS,
): void {
  suppressUntilMs = Date.now() + durationMs
  // #region agent log
  fetch('http://127.0.0.1:7455/ingest/ee4d7135-3aef-4e11-b07a-3de89c3bf62c',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'4fe799'},body:JSON.stringify({sessionId:'4fe799',runId:'fit-suppress',hypothesisId:'H-fit-storm',location:'programmaticFitGuard:begin',message:'fit_suppress_begin',data:{durationMs,until:suppressUntilMs},timestamp:Date.now()})}).catch(()=>{})
  // #endregion
}

export function endProgrammaticFitSuppress(): void {
  suppressUntilMs = 0
}
