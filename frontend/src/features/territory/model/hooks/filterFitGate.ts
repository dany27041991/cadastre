/**
 * Gate for one-shot camera fit after Cerca (attribute filters).
 * Zoom/pan must never arm this — that caused directional map jumps
 * (debug 4fe799: fit on raw-zoom-change:areas-early).
 */
let pendingFilterFit = false

export function armFilterFit(_reason = 'cerca'): void {
  pendingFilterFit = true
}

export function peekFilterFit(): boolean {
  return pendingFilterFit
}

/** Returns true once; clears the arm. */
export function consumeFilterFit(_reason = 'fit'): boolean {
  if (!pendingFilterFit) return false
  pendingFilterFit = false
  return true
}

export function clearFilterFit(_reason = 'clear'): void {
  if (!pendingFilterFit) return
  pendingFilterFit = false
}
