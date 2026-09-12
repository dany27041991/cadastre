/**
 * Pure cell formatters for the green data table (no React deps).
 */

export type GreenTableRow = Record<string, string | number>

const FORMAT_MAX_DEPTH = 5

function isPlainScalar(v: unknown): boolean {
  return v == null || typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean'
}

function scalarToString(v: unknown, formatBoolean: (b: boolean) => string): string {
  if (v == null) return '—'
  if (typeof v === 'string') return v
  if (typeof v === 'number') return String(v)
  if (typeof v === 'boolean') return formatBoolean(v)
  return '—'
}

function formatComplexValue(
  v: unknown,
  formatBoolean: (b: boolean) => string,
  depth = 0,
): string {
  if (depth > FORMAT_MAX_DEPTH) return '…'
  if (isPlainScalar(v)) return scalarToString(v, formatBoolean)

  if (Array.isArray(v)) {
    if (v.length === 0) return '—'
    if (v.every(isPlainScalar)) return v.map((x) => scalarToString(x, formatBoolean)).join(', ')
    return v
      .map((item, i) => {
        const inner = formatComplexValue(item, formatBoolean, depth + 1)
        return inner.includes('\n')
          ? `${i + 1}. ${inner.replace(/\n/g, '\n  ')}`
          : `${i + 1}. ${inner}`
      })
      .join('\n')
  }

  if (typeof v === 'object' && v !== null) {
    const o = v as Record<string, unknown>
    const keys = Object.keys(o)
    if (keys.length === 0) return '{}'
    return keys
      .map((k) => {
        const inner = formatComplexValue(o[k], formatBoolean, depth + 1)
        return inner.includes('\n')
          ? `${k}:\n  ${inner.replace(/\n/g, '\n  ')}`
          : `${k}: ${inner}`
      })
      .join('\n')
  }

  try {
    return JSON.stringify(v)
  } catch {
    return String(v)
  }
}

export function cellValue(
  v: unknown,
  formatBoolean: (b: boolean) => string,
): string | number {
  if (v == null) return 'NaN'
  if (typeof v === 'number' || typeof v === 'string') return v === '' ? 'NaN' : v
  if (typeof v === 'boolean') return formatBoolean(v)
  return formatComplexValue(v, formatBoolean, 0)
}
