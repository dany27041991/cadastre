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

export function beginViewportLoadBurst(_reason: string): AbortSignal {
  if (abortCtrl != null) {
    abortCtrl.abort()
  }
  abortCtrl = new AbortController()
  burstActive = true
  tableMayFetch = false
  return abortCtrl.signal
}

export function endViewportLoadBurst(_reason: string): void {
  burstActive = false
  tableMayFetch = true
}

/** Keep table/zoom blocked while MinIO recovers (debug 4fe799 2nd Cerca). */
export function holdViewportBurstMs(ms: number, _reason: string): void {
  burstHoldUntil = Math.max(burstHoldUntil, Date.now() + ms)
}

export function isViewportLoadBurstActive(): boolean {
  return burstActive || Date.now() < burstHoldUntil
}

/** Table wait: zoom/pan stay blocked, table can start after areas-early. */
export function markAreasReadyForTable(_reason: string): void {
  tableMayFetch = true
}

export function isTableFetchBlocked(): boolean {
  if (Date.now() < burstHoldUntil && !tableMayFetch) return true
  return burstActive && !tableMayFetch
}

export function currentViewportAbortSignal(): AbortSignal | undefined {
  return abortCtrl?.signal
}
