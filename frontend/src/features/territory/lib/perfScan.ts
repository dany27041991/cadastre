/**
 * Correlated Cerca→viewport→mount→table waterfall for debug session 4fe799.
 * Marks are relative to the last startPerfScan() call.
 */
type PhaseExtra = Record<string, unknown>

type ScanState = {
  id: string
  t0: number
  phases: Array<{ name: string; ms: number; extra?: PhaseExtra }>
}

let scan: ScanState | null = null

function emit(message: string, data: Record<string, unknown>, hypothesisId: string) {
  // #region agent log
  fetch('http://127.0.0.1:7455/ingest/ee4d7135-3aef-4e11-b07a-3de89c3bf62c', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Debug-Session-Id': '4fe799',
    },
    body: JSON.stringify({
      sessionId: '4fe799',
      runId: 'perf-scan',
      hypothesisId,
      location: 'perfScan.ts',
      message,
      data,
      timestamp: Date.now(),
    }),
  }).catch(() => {})
  // #endregion
}

export function startPerfScan(label: string, extra?: PhaseExtra): string {
  const id = `ps_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`
  scan = { id, t0: performance.now(), phases: [] }
  emit('perf_scan_start', { scanId: id, label, ...(extra ?? {}) }, 'H-perf-scan')
  return id
}

export function markPerfScan(name: string, extra?: PhaseExtra): void {
  if (!scan) {
    emit('perf_scan_orphan_mark', { name, ...(extra ?? {}) }, 'H-perf-scan')
    return
  }
  const ms = Math.round(performance.now() - scan.t0)
  scan.phases.push({ name, ms, extra })
  emit(
    'perf_scan_mark',
    { scanId: scan.id, name, ms, ...(extra ?? {}) },
    'H-perf-scan',
  )
}

export function finishPerfScan(why: string, extra?: PhaseExtra): void {
  if (!scan) return
  const wallMs = Math.round(performance.now() - scan.t0)
  const phases = scan.phases.map((p) => ({ name: p.name, ms: p.ms }))
  const deltas: Record<string, number> = {}
  for (let i = 0; i < scan.phases.length; i += 1) {
    const prev = i === 0 ? 0 : scan.phases[i - 1].ms
    deltas[scan.phases[i].name] = scan.phases[i].ms - prev
  }
  emit(
    'perf_scan_finish',
    {
      scanId: scan.id,
      why,
      wallMs,
      phases,
      deltas,
      ...(extra ?? {}),
    },
    'H-perf-scan',
  )
  scan = null
}

export function currentPerfScanId(): string | null {
  return scan?.id ?? null
}
