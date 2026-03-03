/**
 * Data fetchers for green areas levels (green_areas, sub_areas). Fetch GeoJSON from API.
 */
import type { TerritoryGreenAreasApi, TerritoryLevel, BreadcrumbCrumb } from '../../types'
import { I18N_KEYS } from '../constants'

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
      last.regionId == null || last.provinceId == null
        ? Promise.reject(new Error(I18N_KEYS.regionIdRequired))
        : api.getGreenAreas({
            regionId: last.regionId,
            provinceId: last.provinceId,
            municipalityId: last.id,
            subMunicipalAreaId: last.subMunicipalAreaId,
          }),
    sub_areas: (last) =>
      last.regionId == null || last.provinceId == null
        ? Promise.reject(new Error(I18N_KEYS.regionIdRequired))
        : api.getGreenAreas({
            regionId: last.regionId,
            provinceId: last.provinceId,
            parentId: last.id,
          }),
  }
}
