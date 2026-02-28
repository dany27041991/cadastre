/**
 * Data fetchers for territory level (breadcrumb → fetch GeoJSON). Not UI loaders.
 */
import type { TerritoryLevel, BreadcrumbCrumb, TerritoryNavigationApi } from '../../types'
import { filterSubMunicipalByDrill } from '../../lib/subMunicipalDrill'
import { createGreenAreasLevelFetchers } from './levelFetchers'

type GeoJSON = Awaited<ReturnType<TerritoryNavigationApi['getGreenAreas']>>

export function createLevelFetchers(
  api: TerritoryNavigationApi
): Partial<
  Record<
    TerritoryLevel,
    (last: BreadcrumbCrumb) => Promise<GeoJSON>
  >
> {
  const greenAreasFetchers = createGreenAreasLevelFetchers(api)
  return {
    provinces: (last) => api.getProvincesByRegion(last.id),
    municipalities: (last) => api.getMunicipalitiesByProvince(last.id),
    sub_municipal_areas: async (last) => {
      const fullGeoJson = await api.getSubMunicipalAreasByMunicipality(last.id)
      return filterSubMunicipalByDrill(fullGeoJson, 1, [])
    },
    ...greenAreasFetchers,
  }
}
