/**
 * Opt-in debug logging for green layer toggles → map viewport → table.
 *
 * Enable:
 *   localStorage.setItem('DEBUG_GREEN_FILTERS', '1')
 * or build-time:
 *   VITE_DEBUG_GREEN_FILTERS=1
 * or in Vitest propagation suites:
 *   enableGreenFiltersDebugForTests()
 */

export type GreenFilterDebugChannel = 'FILTER' | 'MAP_VIEWPORT' | 'TABLE'

export interface GreenFilterDebugLogEntry {
  readonly channel: GreenFilterDebugChannel
  readonly message: string
  readonly data: Record<string, unknown>
  readonly ts: number
}

let correlationSeq = 0
let forcedDebugForTests = false
const debugLogSink: GreenFilterDebugLogEntry[] = []

export function isGreenFiltersDebug(): boolean {
  if (forcedDebugForTests) return true
  try {
    if (import.meta.env?.VITE_DEBUG_GREEN_FILTERS === '1') return true
  } catch {
    /* non-Vite / SSR */
  }
  try {
    if (typeof localStorage !== 'undefined' && localStorage.getItem('DEBUG_GREEN_FILTERS') === '1') {
      return true
    }
  } catch {
    /* private mode */
  }
  return false
}

/** Force debug ON and clear the in-memory sink (propagation tests). */
export function enableGreenFiltersDebugForTests(): void {
  forcedDebugForTests = true
  debugLogSink.length = 0
}

/** Clear sink and disable forced test debug. */
export function resetGreenFiltersDebug(): void {
  forcedDebugForTests = false
  debugLogSink.length = 0
  correlationSeq = 0
}

/** Snapshot of captured debug entries (for assertions). */
export function getGreenFilterDebugLogs(): readonly GreenFilterDebugLogEntry[] {
  return [...debugLogSink]
}

export function getGreenFilterDebugLogsByChannel(
  channel: GreenFilterDebugChannel,
): readonly GreenFilterDebugLogEntry[] {
  return debugLogSink.filter((e) => e.channel === channel)
}

/** Short id to correlate one toggle flip across FILTER / MAP / TABLE logs. */
export function nextGreenFilterCorrelationId(): string {
  correlationSeq += 1
  return `gf-${Date.now().toString(36)}-${correlationSeq}`
}

export function logGreenFilter(
  channel: GreenFilterDebugChannel,
  message: string,
  data?: Record<string, unknown>,
): void {
  if (!isGreenFiltersDebug()) return
  const entry: GreenFilterDebugLogEntry = {
    channel,
    message,
    data: data ?? {},
    ts: Date.now(),
  }
  debugLogSink.push(entry)
  // eslint-disable-next-line no-console
  console.debug(`[${channel}] ${message}`, entry.data)
}
