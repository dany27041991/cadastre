/**
 * Territory API: geo hierarchy + green areas + green assets.
 * Uses authFetch (FGP + cookies) by default for authenticated calls.
 */
import { API_URL } from '@/shared/config/map'
import { authFetch } from '@/shared/lib/auth'
import {
  createFetcher,
  type FetcherOptions,
  type GeoJSONFeatureCollection,
} from './fetcher'
import { createGreenAreasApi, type GreenAreasApi } from './greenAreaMap.api'
import { createGreenAssetsApi, type GreenAssetsApi } from './greenAssetMap.api'

export type { GeoJSONFeatureCollection, FetcherOptions } from './fetcher'
export { EMPTY_GEOJSON, createFetcher, type Fetcher } from './fetcher'
export type { GreenAreasParams } from './greenAreaMap.api'
export type { GreenAssetParams } from './greenAssetMap.api'
export { buildGreenAreasQuery } from './greenAreaMap.api'
export { buildGreenAssetQuery } from './greenAssetMap.api'

const GEOBUF = 'format=geobuf'

export interface TerritoryGeoApi {
  getRegions: () => Promise<GeoJSONFeatureCollection>
  getProvincesByRegion: (regionId: number) => Promise<GeoJSONFeatureCollection>
  getMunicipalitiesByProvince: (
    provinceId: number
  ) => Promise<GeoJSONFeatureCollection>
  getSubMunicipalAreasByMunicipality: (
    municipalityId: number
  ) => Promise<GeoJSONFeatureCollection>
}

export type TerritoryGreenAreasApi = GreenAreasApi
export type TerritoryGreenAssetsApi = GreenAssetsApi
export type TerritoryNavigationApi = TerritoryGeoApi & TerritoryGreenAreasApi
export type TerritoryApi = TerritoryGeoApi &
  TerritoryGreenAreasApi &
  TerritoryGreenAssetsApi

export type TerritoryApiOptions = FetcherOptions

export function createTerritoryApi(
  options: TerritoryApiOptions = {}
): TerritoryApi {
  const { baseUrl = API_URL, fetchFn = authFetch } = options
  const { fetchGeobufOrEmpty } = createFetcher(baseUrl, fetchFn)
  const greenAreaMap = createGreenAreasApi(options)
  const greenAssetMap = createGreenAssetsApi(options)

  return {
    getRegions: () =>
      fetchGeobufOrEmpty(`/api/territory/regions?${GEOBUF}`),
    getProvincesByRegion: (regionId: number) =>
      fetchGeobufOrEmpty(
        `/api/territory/regions/${regionId}/provinces?${GEOBUF}`
      ),
    getMunicipalitiesByProvince: (provinceId: number) =>
      fetchGeobufOrEmpty(
        `/api/territory/provinces/${provinceId}/municipalities?${GEOBUF}`
      ),
    getSubMunicipalAreasByMunicipality: (municipalityId: number) =>
      fetchGeobufOrEmpty(
        `/api/territory/municipalities/${municipalityId}/sub-municipal-areas?${GEOBUF}`
      ),
    getGreenAreas: greenAreaMap.getGreenAreas,
    getGreenAssets: greenAssetMap.getGreenAssets,
  }
}

export const territoryApi = createTerritoryApi()
