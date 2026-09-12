/**
 * Dual-mode area → assets drill: parse row partition keys and build a scoped
 * assets table query (avoids national COUNT over all lakehouse prefixes).
 */
import type { GreenTableRawRow } from './GreenTableRowActions'

/** Drill scope: green_area_id + partition keys so BE does not COUNT all of Italy. */
export type DrillAreaScope = {
  id: number
  label: string | null
  regionId: number | null
  provinceId: number | null
  municipalityId: number | null
}

function greenAreaIdFromRow(row: GreenTableRawRow): number | null {
  const raw = row.id
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw
  if (typeof raw === 'string' && raw.trim() !== '') {
    const n = Number(raw)
    return Number.isFinite(n) ? n : null
  }
  return null
}

function positiveIntFromRow(row: GreenTableRawRow, key: string): number | null {
  const raw = row[key]
  if (typeof raw === 'number' && Number.isFinite(raw) && raw > 0) return Math.trunc(raw)
  if (typeof raw === 'string' && raw.trim() !== '') {
    const n = Number(raw)
    return Number.isFinite(n) && n > 0 ? Math.trunc(n) : null
  }
  return null
}

export function areaLabelFromRow(row: GreenTableRawRow): string | null {
  const name = row.name
  if (typeof name === 'string' && name.trim() !== '') return name.trim()
  const label = row.green_area_label
  if (typeof label === 'string' && label.trim() !== '') return label.trim()
  return null
}

export function drillScopeFromRow(row: GreenTableRawRow): DrillAreaScope | null {
  const id = greenAreaIdFromRow(row)
  if (id == null) return null
  return {
    id,
    label: areaLabelFromRow(row),
    regionId: positiveIntFromRow(row, 'region_id'),
    provinceId: positiveIntFromRow(row, 'province_id'),
    municipalityId: positiveIntFromRow(row, 'municipality_id'),
  }
}

export function withDrillAssetsQuery(territoryQuery: string, drill: DrillAreaScope): string {
  const p = new URLSearchParams(territoryQuery)
  p.set('green_area_id', String(drill.id))
  // Prefer the area's partition over a wider (national) breadcrumb so lakehouse
  // resolves one municipality and returns an exact total immediately.
  if (drill.regionId != null) p.set('region_id', String(drill.regionId))
  if (drill.provinceId != null) p.set('province_id', String(drill.provinceId))
  if (drill.municipalityId != null) p.set('municipality_id', String(drill.municipalityId))
  return p.toString()
}

export function drillScopeFromAssetsTableQuery(
  assetsTableQuery: string,
): DrillAreaScope | null {
  const params = new URLSearchParams(assetsTableQuery)
  const fromNav = Number(params.get('green_area_id'))
  if (!Number.isFinite(fromNav) || fromNav <= 0) return null
  const regionRaw = Number(params.get('region_id'))
  const provinceRaw = Number(params.get('province_id'))
  const municipalityRaw = Number(params.get('municipality_id'))
  return {
    id: fromNav,
    label: null,
    regionId: Number.isFinite(regionRaw) && regionRaw > 0 ? regionRaw : null,
    provinceId: Number.isFinite(provinceRaw) && provinceRaw > 0 ? provinceRaw : null,
    municipalityId:
      Number.isFinite(municipalityRaw) && municipalityRaw > 0 ? municipalityRaw : null,
  }
}
