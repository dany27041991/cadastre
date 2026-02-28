/**
 * Data fetchers for green areas levels (green_areas, sub_areas). Fetch GeoJSON from API.
 */
import type { TerritoryGreenAreasApi, TerritoryLevel, BreadcrumbCrumb } from '../../types'

export type GreenAreasLevel = Extract<TerritoryLevel, 'green_areas' | 'sub_areas'>

export function createGreenAreasLevelFetchers(
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
            subMunicipalAreaId: last.subMunicipalAreaId,
          }),
    sub_areas: (last) =>
      last.regionId == null
        ? Promise.reject(new Error('regionId required'))
        : api.getGreenAreas({ regionId: last.regionId, parentId: last.id }),
  }
}
