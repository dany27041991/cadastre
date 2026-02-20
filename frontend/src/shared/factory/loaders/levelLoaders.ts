/**
 * Green areas level loaders: green_areas and sub_areas (SOLID: Single Responsibility).
 * Used by mapNavigationLoaders to build the full level → loader map.
 */
import type { TerritoryGreenAreasApi } from '@/shared/types/api'
import type { TerritoryLevel, BreadcrumbCrumb } from '@/shared/types/territory'

export type GreenAreasLevel = Extract<TerritoryLevel, 'green_areas' | 'sub_areas'>

/** Loaders for green areas hierarchy only (green_areas, sub_areas). */
export function createGreenAreasLevelLoaders(
  api: TerritoryGreenAreasApi
): Partial<
  Record<
    GreenAreasLevel,
    (last: BreadcrumbCrumb) => ReturnType<TerritoryGreenAreasApi['getGreenAreas']>
  >
> {
  return {
    green_areas: (last) =>
      last.regionId == null
        ? Promise.reject(new Error('regionId required'))
        : api.getGreenAreas({
            regionId: last.regionId,
            municipalityId: last.id,
            districtId: last.districtId,
          }),
    sub_areas: (last) =>
      last.regionId == null
        ? Promise.reject(new Error('regionId required'))
        : api.getGreenAreas({ regionId: last.regionId, parentId: last.id }),
  }
}
