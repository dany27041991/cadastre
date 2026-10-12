/**
 * Build / complete the admin breadcrumb when exploding a green area from a
 * shallow context (e.g. nationwide viewport → Italia>Park 61).
 */
import type { GeoJSONFeatureCollection } from '@/shared/types'
import type { BreadcrumbCrumb } from '@/features/territory/types'
import type { TerritoryMapFeature } from '@/features/territory/types/mapFeature'
import type { GreenDetailDto } from '@/features/territory/api/greenDetail.api'
import { resolveFeatureId } from '@/features/territory/lib/featureIdentity'

function toPositiveInt(value: unknown): number | undefined {
  const n = typeof value === 'string' && value.trim() === '' ? NaN : Number(value)
  return Number.isFinite(n) && n > 0 ? n : undefined
}

function ringContains(point: [number, number], ring: number[][]): boolean {
  const [x, y] = point
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i]?.[0]
    const yi = ring[i]?.[1]
    const xj = ring[j]?.[0]
    const yj = ring[j]?.[1]
    if (xi == null || yi == null || xj == null || yj == null) continue
    const intersect =
      yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi + Number.EPSILON) + xi
    if (intersect) inside = !inside
  }
  return inside
}

function geometryContainsPoint(geometry: object, point: [number, number]): boolean {
  const g = geometry as {
    type?: string
    coordinates?: unknown
  }
  if (g.type === 'Polygon' && Array.isArray(g.coordinates?.[0])) {
    return ringContains(point, g.coordinates[0] as number[][])
  }
  if (g.type === 'MultiPolygon' && Array.isArray(g.coordinates)) {
    for (const poly of g.coordinates as number[][][][]) {
      const ring = poly?.[0]
      if (ring && ringContains(point, ring)) return true
    }
  }
  return false
}

function centroidOfGeometry(geometry: object): [number, number] | null {
  const g = geometry as { type?: string; coordinates?: unknown }
  const pushCoords = (coords: unknown, acc: number[]) => {
    if (!Array.isArray(coords)) return
    if (typeof coords[0] === 'number' && typeof coords[1] === 'number') {
      acc.push(coords[0] as number, coords[1] as number)
      return
    }
    for (const c of coords) pushCoords(c, acc)
  }
  const flat: number[] = []
  pushCoords(g.coordinates, flat)
  if (flat.length < 2) return null
  let sx = 0
  let sy = 0
  let n = 0
  for (let i = 0; i < flat.length; i += 2) {
    sx += flat[i]
    sy += flat[i + 1]
    n += 1
  }
  if (n === 0) return null
  return [sx / n, sy / n]
}

export type AdminPathLabels = {
  regionLabel?: string | null
  provinceLabel?: string | null
  municipalityLabel?: string | null
}

export type ResolveAdminBreadcrumbArgs = {
  areaId: number
  areaLabel: string
  regionId: number
  provinceId: number
  municipalityId?: number
  feature?: TerritoryMapFeature | unknown
  detail?: GreenDetailDto | null
  existing: BreadcrumbCrumb[]
  labelGreenAreas: string
  suffixProvince: string
  fetchSubMunicipalAreas: (municipalityId: number) => Promise<GeoJSONFeatureCollection>
  /**
   * Leaf selection: keep parent `sub_areas` crumbs (via feature parent_id) and
   * append this area → e.g. Park 229 > Park 229 - Zone 3.
   */
  appendLeafUnderParent?: boolean
}

/**
 * Returns a full admin trail ending with the drilled green area crumb.
 * Reuses existing crumbs when already deep enough; otherwise synthesizes
 * provinces → municipalities → sub_municipal_areas → green_areas → sub_areas.
 */
export async function resolveAdminBreadcrumbForGreenDrill(
  args: ResolveAdminBreadcrumbArgs
): Promise<BreadcrumbCrumb[]> {
  const {
    areaId,
    areaLabel,
    regionId,
    provinceId,
    feature,
    detail,
    existing,
    labelGreenAreas,
    suffixProvince,
    fetchSubMunicipalAreas,
    appendLeafUnderParent = false,
  } = args

  const props =
    feature && typeof feature === 'object' && 'properties' in feature
      ? ((feature as TerritoryMapFeature).properties ?? {})
      : {}

  const municipalityId =
    args.municipalityId ??
    toPositiveInt(props.municipality_id) ??
    toPositiveInt(detail?.summary.municipalityId) ??
    existing.find((c) => c.level === 'green_areas')?.id ??
    existing.find((c) => c.level === 'sub_municipal_areas')?.id ??
    existing.find((c) => c.municipalityId != null)?.municipalityId

  const regionLabel =
    detail?.summary.regionLabel ??
    existing.find((c) => c.level === 'provinces')?.label ??
    String(regionId)
  const provinceLabelRaw =
    detail?.summary.provinceLabel ??
    existing.find((c) => c.level === 'municipalities')?.label?.replace(suffixProvince, '') ??
    String(provinceId)
  const municipalityLabel =
    detail?.summary.municipalityLabel ??
    existing.find((c) => c.level === 'sub_municipal_areas')?.label ??
    (municipalityId != null ? String(municipalityId) : '—')

  const hasAdminTrail =
    existing.some((c) => c.level === 'provinces') &&
    existing.some((c) => c.level === 'municipalities')

  let crumbs: BreadcrumbCrumb[] = hasAdminTrail
    ? [...existing]
    : [
        { level: 'provinces', id: regionId, label: String(regionLabel) },
        {
          level: 'municipalities',
          id: provinceId,
          label: `${provinceLabelRaw}${suffixProvince}`,
        },
      ]

  if (municipalityId != null && !crumbs.some((c) => c.level === 'sub_municipal_areas')) {
    crumbs = [
      ...crumbs,
      { level: 'sub_municipal_areas', id: municipalityId, label: String(municipalityLabel) },
    ]
  }

  let subMunicipalAreaId =
    crumbs.find((c) => c.level === 'green_areas')?.subMunicipalAreaId ??
    crumbs.find((c) => c.level === 'sub_areas')?.subMunicipalAreaId
  let subMunicipalLabel =
    crumbs.find((c) => c.level === 'green_areas' && c.subMunicipalAreaId != null)?.label

  if (municipalityId != null && subMunicipalAreaId == null && feature) {
    const geom =
      feature && typeof feature === 'object' && 'geometry' in feature
        ? (feature as TerritoryMapFeature).geometry
        : null
    const centroid = geom ? centroidOfGeometry(geom) : null
    if (centroid) {
      try {
        const subs = await fetchSubMunicipalAreas(municipalityId)
        for (const f of subs.features ?? []) {
          if (!f.geometry) continue
          if (!geometryContainsPoint(f.geometry as object, centroid)) continue
          const id = resolveFeatureId(f.properties ?? {}, f.id as number)
          if (id == null) continue
          subMunicipalAreaId = id
          subMunicipalLabel =
            String((f.properties as { name?: string } | undefined)?.name ?? '') ||
            String(id)
          break
        }
      } catch {
        // keep path without municipio when spatial resolve fails
      }
    }
  }

  // Drop trailing green/sub crumbs — rebuild them for the drilled area.
  const existingSubAreas = existing.filter((c) => c.level === 'sub_areas')
  crumbs = crumbs.filter((c) => c.level !== 'green_areas' && c.level !== 'sub_areas')

  if (municipalityId != null) {
    crumbs = [
      ...crumbs,
      {
        level: 'green_areas',
        id: municipalityId,
        label:
          subMunicipalAreaId != null && subMunicipalLabel
            ? subMunicipalLabel
            : labelGreenAreas,
        regionId,
        provinceId,
        ...(subMunicipalAreaId != null ? { subMunicipalAreaId } : {}),
      },
    ]
  }

  const subAreaCrumb: BreadcrumbCrumb = {
    level: 'sub_areas',
    id: areaId,
    label: areaLabel,
    regionId,
    provinceId,
    ...(municipalityId != null ? { municipalityId } : {}),
    ...(subMunicipalAreaId != null ? { subMunicipalAreaId } : {}),
  }

  if (appendLeafUnderParent) {
    const parentId =
      toPositiveInt(props.parent_id) ??
      existingSubAreas[existingSubAreas.length - 1]?.id
    let keptSubs = existingSubAreas
    if (parentId != null) {
      const parentIdx = existingSubAreas.findIndex((c) => c.id === parentId)
      if (parentIdx >= 0) {
        keptSubs = existingSubAreas.slice(0, parentIdx + 1)
      }
    }
    if (keptSubs[keptSubs.length - 1]?.id === areaId) {
      crumbs = [...crumbs, ...keptSubs]
    } else {
      crumbs = [...crumbs, ...keptSubs, subAreaCrumb]
    }
  } else {
    crumbs = [...crumbs, subAreaCrumb]
  }

  return crumbs
}
