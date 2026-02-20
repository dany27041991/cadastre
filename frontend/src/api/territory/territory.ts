/**
 * Territory API: geo hierarchy (regions → provinces → municipalities → districts)
 * and composition of green areas + green assets APIs.
 * SOLID: delegates to areas and assets modules.
 */
import { API_URL } from '../../shared/constants/map'
import {
  createFetcher,
  type GeoJSONFeatureCollection,
} from '../client'
import { createGreenAreasApi, type GreenAreasApi } from './areas/greenAreas.api'
import { createGreenAssetsApi, type GreenAssetsApi } from './assets/greenAssets.api'

export type { GeoJSONFeatureCollection } from '../client'
export { EMPTY_GEOJSON, createFetcher, type Fetcher } from '../client'
export type { GreenAreasParams } from './areas/greenAreas.api'
export type { GreenAssetParams } from './assets/greenAssets.api'
export { buildGreenAreasQuery } from './areas/greenAreas.api'
export { buildGreenAssetQuery } from './assets/greenAssets.api'

/** Geo hierarchy API: regions → provinces → municipalities → districts. */
export interface TerritoryGeoApi {
  getRegions: () => Promise<GeoJSONFeatureCollection>
  getProvincesByRegion: (regionId: number) => Promise<GeoJSONFeatureCollection>
  getMunicipalitiesByProvince: (
    provinceId: number
  ) => Promise<GeoJSONFeatureCollection>
  getDistrictsByMunicipality: (
    municipalityId: number
  ) => Promise<GeoJSONFeatureCollection>
}

export type TerritoryGreenAreasApi = GreenAreasApi
export type TerritoryGreenAssetsApi = GreenAssetsApi

/** Minimal API for breadcrumb → fetch (navigation). TerritoryGeoApi + TerritoryGreenAreasApi. */
export type TerritoryNavigationApi = TerritoryGeoApi & TerritoryGreenAreasApi

export type TerritoryApi = TerritoryGeoApi &
  TerritoryGreenAreasApi &
  TerritoryGreenAssetsApi

export interface TerritoryApiOptions {
  baseUrl?: string
  fetchFn?: (url: string) => Promise<Response>
}

export function createTerritoryApi(
  options: TerritoryApiOptions = {}
): TerritoryApi {
  const { baseUrl = API_URL, fetchFn = fetch } = options
  const { fetchGeoJson, fetchGeoJsonOrEmpty } = createFetcher(baseUrl, fetchFn)
  const greenAreas = createGreenAreasApi(options)
  const greenAssets = createGreenAssetsApi(options)

  return {
    getRegions: () => fetchGeoJson('/api/territory/regions'),
    getProvincesByRegion: (regionId: number) =>
      fetchGeoJson(`/api/territory/regions/${regionId}/provinces`),
    getMunicipalitiesByProvince: (provinceId: number) =>
      fetchGeoJson(`/api/territory/provinces/${provinceId}/municipalities`),
    getDistrictsByMunicipality: (municipalityId: number) =>
      fetchGeoJsonOrEmpty(`/api/territory/municipalities/${municipalityId}/districts`),
    getGreenAreas: greenAreas.getGreenAreas,
    getGreenAssets: greenAssets.getGreenAssets,
  }
}

/** Default instance (uses API_URL and global fetch). */
export const territoryApi = createTerritoryApi()
