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
  kind: 'area' | 'asset',
): TerritoryMapFeature | undefined {
  // Without row municipality, never reuse a mounted feature by id alone
  // (id=3 is ZRIL-1-3 and ZRIL-156-3 in different comuni).
  if (rowMunicipalityId == null) return undefined
  // Areas are listed before assets in getGreenLayerFeatures — matching by id+muni
  // alone can bind an asset row to an area polygon with the same local id.
  const sameScope = mountedFeatures.filter((f) => {
    if (f.id !== id) return false
    return municipalityIdFromProperties(f.properties) === rowMunicipalityId
  })
  if (sameScope.length === 0) return undefined
  const wantPoint = kind === 'asset'
  const byGeom = sameScope.find((f) => {
    const t = (f.geometry as { type?: string } | undefined)?.type
    if (wantPoint) return t === 'Point' || t === 'MultiPoint'
    return t === 'Polygon' || t === 'MultiPolygon' || t === 'LineString' || t === 'MultiLineString'
  })
  let picked = byGeom
  if (!picked && sameScope.length === 1) {
    const only = sameScope[0]
    const t = (only.geometry as { type?: string } | undefined)?.type
    const looksArea = t === 'Polygon' || t === 'MultiPolygon' || t === 'LineString' || t === 'MultiLineString'
    const looksAsset = t === 'Point' || t === 'MultiPoint'
    // Refuse cross-kind reuse (asset row → area polygon with same local id).
    if (!(kind === 'asset' && looksArea) && !(kind === 'area' && looksAsset)) {
      picked = only
    }
  }
  // #region agent log
  fetch('http://127.0.0.1:7455/ingest/ee4d7135-3aef-4e11-b07a-3de89c3bf62c',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'4fe799'},body:JSON.stringify({sessionId:'4fe799',runId:'asset-vs-area',hypothesisId:'H-mounted-kind',location:'greenTableRowToMapFeature:findMounted',message:'table_mounted_resolve',data:{kind,id,rowMunicipalityId,sameScopeN:sameScope.length,pickedGeom:(picked?.geometry as {type?:string})?.type??null,pickedByGeom:Boolean(byGeom),refusedCrossKind:!picked&&sameScope.length>0,candidates:sameScope.map(f=>({geom:(f.geometry as {type?:string})?.type??null,label:f.label}))},timestamp:Date.now()})}).catch(()=>{})
  // #endregion
  return picked
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
  const mounted = findMountedForRow(mountedFeatures, id, rowMunicipalityId, kind)
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

  // Table rows expose lon/lat scalars — build a Point so detail highlight/anchor
  // do not fall back to a same-id area polygon (debug 4fe799 plant_code=2).
  const geometry = pointGeometryFromRow(row) ?? {}
  return {
    id,
    label,
    feature: {
      id,
      label,
      properties: rowProps,
      geometry,
    },
  }
}

function pointGeometryFromRow(row: GreenTableRawRow): object | null {
  const lon = Number(row.longitude ?? row.lon ?? row.lng)
  const lat = Number(row.latitude ?? row.lat)
  if (!Number.isFinite(lon) || !Number.isFinite(lat)) return null
  return { type: 'Point', coordinates: [lon, lat] }
}
