/**
 * Loaders for territory navigation level (SOLID: Single Responsibility).
 * Composes geo hierarchy loaders and green areas loaders.
 */
import type { TerritoryLevel, BreadcrumbCrumb } from '@/shared/types/territory'
import type { TerritoryNavigationApi } from '@/shared/types/api'
import { createGreenAreasLevelLoaders } from './levelLoaders'

export type { TerritoryNavigationApi } from '@/shared/types/api'

/** Level → loader map. Used by navigateTo to reduce complexity. */
export function createLevelLoaders(
  api: TerritoryNavigationApi
): Partial<
  Record<
    TerritoryLevel,
    (
      last: BreadcrumbCrumb
    ) => ReturnType<TerritoryNavigationApi['getGreenAreas']>
  >
> {
  const greenAreasLoaders = createGreenAreasLevelLoaders(api)
  return {
    provinces: (last) => api.getProvincesByRegion(last.id),
    municipalities: (last) => api.getMunicipalitiesByProvince(last.id),
    districts: (last) => api.getDistrictsByMunicipality(last.id),
    ...greenAreasLoaders,
  }
}
