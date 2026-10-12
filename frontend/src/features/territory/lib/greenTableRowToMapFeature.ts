/**
 * Build a TerritoryMapFeature from a green table row.
 * Prefers a feature already mounted on the map (for highlight + geometry).
 *
 * Area/asset ``id`` is unique only within a municipality — never match mounted
 * map features by numeric id alone.
 */
import type { TerritoryMapFeature } from '@/features/territory/types/mapFeature'
import { municipalityIdFromProperties } from '@/features/territory/lib/greenAreaGeomId'

type GreenTableRawRow = Record<string, unknown>

const SCOPE_PROP_KEYS = ['region_id', 'province_id', 'municipality_id'] as const

export function positiveIntFromUnknown(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) return value
  if (typeof value === 'string' && value.trim() !== '') {
    const n = Number(value)
    return Number.isFinite(n) && n > 0 ? n : null
  }
  return null
}

function labelFromAreaRow(row: GreenTableRawRow, id: number): string {
  const name = row.name
  if (typeof name === 'string' && name.trim() !== '') return name.trim()
  return String(id)
}

function labelFromAssetRow(row: GreenTableRawRow, id: number): string {
  for (const key of ['species', 'genus', 'asset_type', 'green_area_label'] as const) {
    const v = row[key]
    if (typeof v === 'string' && v.trim() !== '') return v.trim()
  }
  return String(id)
}

/** Scalar props only — table rows have no geometry. */
function propertiesFromRow(row: GreenTableRawRow): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(row)) {
    if (v == null) continue
    const t = typeof v
    if (t === 'string' || t === 'number' || t === 'boolean') out[k] = v
  }
  return out
}

/** Prefer table-row partition keys so detail GET uses the correct municipality. */
function overlayScopeFromRow(
  base: Record<string, unknown>,
  rowProps: Record<string, unknown>,
): Record<string, unknown> {
  const out = { ...base }
  for (const key of SCOPE_PROP_KEYS) {
    const n = positiveIntFromUnknown(rowProps[key])
    if (n != null) out[key] = n
  }
  return out
}

function findMountedForRow(
  mountedFeatures: readonly TerritoryMapFeature[],
  id: number,
  rowMunicipalityId: number | null,
): TerritoryMapFeature | undefined {
  // Without row municipality, never reuse a mounted feature by id alone
  // (id=3 is ZRIL-1-3 and ZRIL-156-3 in different comuni).
  if (rowMunicipalityId == null) return undefined
  return mountedFeatures.find((f) => {
    if (f.id !== id) return false
    return municipalityIdFromProperties(f.properties) === rowMunicipalityId
  })
}

export function resolveGreenFeatureFromTableRow(
  row: GreenTableRawRow,
  kind: 'area' | 'asset',
  mountedFeatures: readonly TerritoryMapFeature[],
): { id: number; label: string; feature: TerritoryMapFeature } | null {
  const id = positiveIntFromUnknown(row.id)
  if (id == null) return null

  const rowMunicipalityId = positiveIntFromUnknown(row.municipality_id)
  const rowProps = propertiesFromRow(row)
  const mounted = findMountedForRow(mountedFeatures, id, rowMunicipalityId)
  const label =
    kind === 'asset' ? labelFromAssetRow(row, id) : labelFromAreaRow(row, id)

  if (mounted) {
    return {
      id,
      label: mounted.label || label,
      feature: {
        ...mounted,
        properties: overlayScopeFromRow(mounted.properties ?? {}, rowProps),
      },
    }
  }

  return {
    id,
    label,
    feature: {
      id,
      label,
      properties: rowProps,
      geometry: {},
    },
  }
}
