/**
 * Persist visible green-table columns in localStorage (area vs asset).
 */
import {
  defaultVisibleFor,
  detailColumnsFor,
  type GreenTableKind,
} from './greenDetailColumnCatalog'

const STORAGE_PREFIX = 'linfa.green-table.visible-cols.'

function storageKey(kind: GreenTableKind): string {
  return `${STORAGE_PREFIX}${kind}`
}

function sanitize(kind: GreenTableKind, keys: unknown): string[] {
  const catalog = new Set(detailColumnsFor(kind))
  if (!Array.isArray(keys)) return [...defaultVisibleFor(kind)]
  const out: string[] = []
  const seen = new Set<string>()
  for (const k of keys) {
    if (typeof k !== 'string' || !catalog.has(k) || seen.has(k)) continue
    seen.add(k)
    out.push(k)
  }
  return out.length > 0 ? out : [...defaultVisibleFor(kind)]
}

/** Visible keys in catalog order. */
export function orderVisibleKeys(kind: GreenTableKind, selected: string[]): string[] {
  const selectedSet = new Set(selected)
  return detailColumnsFor(kind).filter((k) => selectedSet.has(k))
}

export function loadVisibleColumns(kind: GreenTableKind): string[] {
  try {
    const raw = localStorage.getItem(storageKey(kind))
    if (raw == null) return [...defaultVisibleFor(kind)]
    return sanitize(kind, JSON.parse(raw) as unknown)
  } catch {
    return [...defaultVisibleFor(kind)]
  }
}

export function saveVisibleColumns(kind: GreenTableKind, keys: string[]): void {
  const sanitized = sanitize(kind, keys)
  try {
    localStorage.setItem(storageKey(kind), JSON.stringify(sanitized))
  } catch {
    // ignore quota / private mode
  }
}

export function toggleVisibleColumn(
  kind: GreenTableKind,
  current: string[],
  key: string
): string[] {
  const catalog = new Set(detailColumnsFor(kind))
  if (!catalog.has(key)) return current
  const next = current.includes(key)
    ? current.filter((k) => k !== key)
    : [...current, key]
  // Keep at least one column visible.
  if (next.length === 0) return current
  const ordered = orderVisibleKeys(kind, next)
  saveVisibleColumns(kind, ordered)
  return ordered
}
