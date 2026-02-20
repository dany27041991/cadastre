/**
 * Green assets API (trees, rows, lawns, etc. for selected area).
 * Endpoint: GET /api/territory/green-assets
 * Uses GeoBuf format for 6-8x smaller payload and faster transfer.
 * On network/backend error returns empty features.
 */
import { API_URL } from '../../../shared/constants/map'
import {
  createFetcher,
  EMPTY_GEOJSON,
  type GeoJSONFeatureCollection,
} from '../../client'

export type GreenAssetParams = {
  regionId: number
  municipalityId: number
  districtId?: number
  greenAreaId?: number
}

export function buildGreenAssetQuery(params: GreenAssetParams): string {
  const search = new URLSearchParams()
  search.set('region_id', String(params.regionId))
  search.set('municipality_id', String(params.municipalityId))
  if (params.districtId != null)
    search.set('district_id', String(params.districtId))
  if (params.greenAreaId != null)
    search.set('green_area_id', String(params.greenAreaId))
  search.set('format', 'geobuf')
  return search.toString()
}

export interface GreenAssetsApi {
  getGreenAssets: (
    params: GreenAssetParams
  ) => Promise<GeoJSONFeatureCollection>
}

export interface GreenAssetsApiOptions {
  baseUrl?: string
  fetchFn?: (url: string) => Promise<Response>
}

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
