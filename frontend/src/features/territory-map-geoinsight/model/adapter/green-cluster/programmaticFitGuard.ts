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
}

export function endProgrammaticFitSuppress(): void {
  suppressUntilMs = 0
}
