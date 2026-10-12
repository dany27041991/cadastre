/**
 * Resolve municipality / province ids for a green-area drill from breadcrumb + feature props.
 */
import { getGreenContext } from './greenMapContext'
import type { BreadcrumbCrumb } from '../types'
import type { TerritoryMapFeature } from '../types/mapFeature'

function toPositiveInt(value: unknown): number | undefined {
  const n = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(n) && n > 0 ? n : undefined
}

export type DrillScopeIds = {
  municipalityId: number | undefined
  provinceId: number | undefined
}

export function resolveDrillScopeIds(
  breadcrumb: BreadcrumbCrumb[],
  clickedFeature?: unknown
): DrillScopeIds {
  const greenCtx = getGreenContext(breadcrumb)
  const featureProps =
    clickedFeature &&
    typeof clickedFeature === 'object' &&
    'properties' in clickedFeature
      ? ((clickedFeature as TerritoryMapFeature).properties ?? {})
      : {}

  const municipalityId =
    greenCtx.municipalityId ??
    breadcrumb.find((c) => c.level === 'green_areas')?.id ??
    toPositiveInt(featureProps.municipality_id)

  const provinceId =
    greenCtx.provinceId ??
    breadcrumb.find((c) => c.level === 'green_areas')?.provinceId ??
    breadcrumb.find((c) => c.level === 'municipalities')?.id ??
    toPositiveInt(featureProps.province_id)

  return { municipalityId, provinceId }
}
