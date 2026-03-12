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
  provinceId: number
  parentId?: number
  municipalityId?: number
  /** When set, only areas intersecting this sub-municipal area are returned. */
  subMunicipalAreaId?: number
  /** When set, returns areas contained in or intersecting this green area (spatial expansion). */
  containedInAreaId?: number
}

export function buildGreenAreasQuery(params: GreenAreasParams): string {
  const search = new URLSearchParams()
  search.set('region_id', String(params.regionId))
  search.set('province_id', String(params.provinceId))
  if (params.parentId != null) search.set('parent_id', String(params.parentId))
  if (params.municipalityId != null)
    search.set('municipality_id', String(params.municipalityId))
  if (params.containedInAreaId != null)
    search.set('contained_in_area_id', String(params.containedInAreaId))
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
