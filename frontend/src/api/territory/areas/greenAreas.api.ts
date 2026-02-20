/**
 * Green areas API (hierarchy, N levels).
 * Endpoint: GET /api/territory/green-areas
 * Uses GeoBuf format for 6-8x smaller payload and faster transfer.
 */
import { API_URL } from '../../../shared/constants/map'
import {
  createFetcher,
  type GeoJSONFeatureCollection,
} from '../../client'

export type GreenAreasParams = {
  regionId: number
  parentId?: number
  municipalityId?: number
  districtId?: number
}

export function buildGreenAreasQuery(params: GreenAreasParams): string {
  const search = new URLSearchParams()
  search.set('region_id', String(params.regionId))
  if (params.parentId != null) search.set('parent_id', String(params.parentId))
  if (params.municipalityId != null)
    search.set('municipality_id', String(params.municipalityId))
  if (params.districtId != null)
    search.set('district_id', String(params.districtId))
  search.set('format', 'geobuf')
  return search.toString()
}

export interface GreenAreasApi {
  getGreenAreas: (
    params: GreenAreasParams
  ) => Promise<GeoJSONFeatureCollection>
}

export interface GreenAreasApiOptions {
  baseUrl?: string
  fetchFn?: (url: string) => Promise<Response>
}

export function createGreenAreasApi(
  options: GreenAreasApiOptions = {}
): GreenAreasApi {
  const { baseUrl = API_URL, fetchFn = fetch } = options
  const { fetchGeobufOrEmpty } = createFetcher(baseUrl, fetchFn)

  return {
    getGreenAreas: (params: GreenAreasParams) =>
      fetchGeobufOrEmpty(
        `/api/territory/green-areas?${buildGreenAreasQuery(params)}`
      ),
  }
}
