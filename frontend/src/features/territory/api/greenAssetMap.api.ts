/**
 * Green assets map API: GeoJSON layer for territory map (trees, rows, lawns, etc.).
 * Endpoint: GET /api/territory/green-assets
 */
import { API_URL } from '@/shared/config/map'
import {
  createFetcher,
  EMPTY_GEOJSON,
  type FetcherOptions,
  type GeoJSONFeatureCollection,
} from './fetcher'

export type GreenAssetParams = {
  regionId: number
  provinceId: number
  municipalityId: number
  greenAreaId?: number
  /** When set, only assets intersecting this sub-municipal area are returned. */
  subMunicipalAreaId?: number
}

export function buildGreenAssetQuery(params: GreenAssetParams): string {
  const search = new URLSearchParams()
  search.set('region_id', String(params.regionId))
  search.set('province_id', String(params.provinceId))
  search.set('municipality_id', String(params.municipalityId))
  if (params.greenAreaId != null)
    search.set('green_area_id', String(params.greenAreaId))
  if (params.subMunicipalAreaId != null)
    search.set('sub_municipal_area_id', String(params.subMunicipalAreaId))
  search.set('format', 'geobuf')
  return search.toString()
}

export interface GreenAssetsApi {
  getGreenAssets: (
    params: GreenAssetParams
  ) => Promise<GeoJSONFeatureCollection>
}

export type GreenAssetsApiOptions = FetcherOptions

export function createGreenAssetsApi(
  options: GreenAssetsApiOptions = {}
): GreenAssetsApi {
  const { baseUrl = API_URL, fetchFn = fetch } = options
  const { fetchGeobufOrEmpty } = createFetcher(baseUrl, fetchFn)

  return {
    getGreenAssets: async (
      params: GreenAssetParams
    ): Promise<GeoJSONFeatureCollection> => {
      try {
        const path = `/api/territory/green-assets?${buildGreenAssetQuery(params)}`
        return await fetchGeobufOrEmpty(path)
      } catch {
        return EMPTY_GEOJSON
      }
    },
  }
}
