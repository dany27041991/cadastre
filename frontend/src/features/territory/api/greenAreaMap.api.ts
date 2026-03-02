/**
 * Green areas map API: GeoJSON layer for territory map (hierarchy, N levels).
 * Endpoint: GET /api/territory/green-areas
 */
import { API_URL } from '@/shared/config/map'
import {
  createFetcher,
  EMPTY_GEOJSON,
  type FetcherOptions,
  type GeoJSONFeatureCollection,
} from './fetcher'

export type GreenAreasParams = {
  regionId: number
  parentId?: number
  provinceId?: number
  municipalityId?: number
  subMunicipalAreaId?: number
}

export function buildGreenAreasQuery(params: GreenAreasParams): string {
  const search = new URLSearchParams()
  search.set('region_id', String(params.regionId))
  if (params.parentId != null) search.set('parent_id', String(params.parentId))
  if (params.provinceId != null) search.set('province_id', String(params.provinceId))
  if (params.municipalityId != null)
    search.set('municipality_id', String(params.municipalityId))
  if (params.subMunicipalAreaId != null)
    search.set('sub_municipal_area_id', String(params.subMunicipalAreaId))
  search.set('format', 'geobuf')
  return search.toString()
}

export interface GreenAreasApi {
  getGreenAreas: (
    params: GreenAreasParams
  ) => Promise<GeoJSONFeatureCollection>
}

export type GreenAreasApiOptions = FetcherOptions

export function createGreenAreasApi(
  options: GreenAreasApiOptions = {}
): GreenAreasApi {
  const { baseUrl = API_URL, fetchFn = fetch } = options
  const { fetchGeobufOrEmpty } = createFetcher(baseUrl, fetchFn)

  return {
    getGreenAreas: async (params: GreenAreasParams) => {
      try {
        return await fetchGeobufOrEmpty(
          `/api/territory/green-areas?${buildGreenAreasQuery(params)}`
        )
      } catch {
        return EMPTY_GEOJSON
      }
    },
  }
}
