/**
 * Resolves the administrative scope for green areas / assets from the
 * navigation breadcrumb, at any depth (empty breadcrumb = nationwide).
 */
import type { BreadcrumbCrumb, GreenContext } from '../types'
import {
  LEVEL_GREEN_AREAS,
  LEVEL_MUNICIPALITIES,
  LEVEL_PROVINCES,
  LEVEL_SUB_AREAS,
  LEVEL_SUB_MUNICIPAL_AREAS,
} from '../model/constants'

/**
 * Breadcrumb crumb semantics: each crumb's `id` is the entity selected to
 * reach that level (crumb `provinces` carries the chosen region id, crumb
 * `municipalities` the chosen province id, and so on).
 */
export function getGreenContext(breadcrumb: BreadcrumbCrumb[]): GreenContext {
  const greenAreasCrumb = breadcrumb.find((b) => b.level === LEVEL_GREEN_AREAS)
  const subAreaCrumbs = breadcrumb.filter((b) => b.level === LEVEL_SUB_AREAS)
  const lastSubArea = subAreaCrumbs[subAreaCrumbs.length - 1]

  const regionId =
    breadcrumb.find((b) => b.level === LEVEL_PROVINCES)?.id ??
    greenAreasCrumb?.regionId ??
    lastSubArea?.regionId
  const provinceId =
    breadcrumb.find((b) => b.level === LEVEL_MUNICIPALITIES)?.id ??
    greenAreasCrumb?.provinceId ??
    lastSubArea?.provinceId
  const municipalityId =
    greenAreasCrumb?.id ??
    lastSubArea?.municipalityId ??
    breadcrumb.find((b) => b.level === LEVEL_SUB_MUNICIPAL_AREAS)?.id

  // Green-area drill overrides sub-municipal scoping (the backend scopes by
  // green_area_id alone in that case).
  const greenAreaId = lastSubArea?.id
  const subMunicipalAreaId =
    greenAreaId == null ? greenAreasCrumb?.subMunicipalAreaId : undefined

  const ctx = { regionId, provinceId, municipalityId, subMunicipalAreaId, greenAreaId }
  return ctx
}

export function greenContextKey(context: GreenContext): string {
  return [
    context.regionId,
    context.provinceId,
    context.municipalityId,
    context.subMunicipalAreaId,
    context.greenAreaId,
  ].join(',')
}

export function isGreenMapLevel(level: string): boolean {
  return level === LEVEL_GREEN_AREAS || level === LEVEL_SUB_AREAS
}
