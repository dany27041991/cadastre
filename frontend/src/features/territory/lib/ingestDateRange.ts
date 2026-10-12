/**
 * Default ingest date window for lakehouse / territory green queries (T5).
 */
export function startOfLocalDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

/** Last 12 months inclusive of today (local calendar). */
export function defaultIngestDateRange(now = new Date()): {
  dateFrom: Date
  dateTo: Date
} {
  const dateTo = startOfLocalDay(now)
  const dateFrom = startOfLocalDay(now)
  dateFrom.setFullYear(dateFrom.getFullYear() - 1)
  return { dateFrom, dateTo }
}

/** ISO calendar date YYYY-MM-DD in local time. */
export function toIsoDate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** Both bounds set and from ≤ to (local calendar days). */
export function hasIngestDateRange(
  dateFrom: Date | null | undefined,
  dateTo: Date | null | undefined,
): boolean {
  if (dateFrom == null || dateTo == null) return false
  return startOfLocalDay(dateFrom).getTime() <= startOfLocalDay(dateTo).getTime()
}
