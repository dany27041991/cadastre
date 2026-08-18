/**
 * Green assets map API: GeoJSON layer for territory map (trees, rows, lawns, etc.).
 * Endpoint: GET /api/territory/green-assets/viewport
 */
import { API_URL } from '@/shared/config/map'
import {
  createFetcher,
  EMPTY_GEOJSON,
  type FetcherOptions,
  type GeoJSONFeatureCollection,
} from './fetcher'

export type GreenAssetViewportParams = {
  /** Viewport bbox [minLon, minLat, maxLon, maxLat] in EPSG:4326. */
  bbox: [number, number, number, number]
  zoom: number
  /** Optional territory scope; omit for a nationwide query. */
  regionId?: number
  provinceId?: number
  municipalityId?: number
  /** When set, only assets intersecting this sub-municipal area are returned. */
  subMunicipalAreaId?: number
  /** When set, only assets intersecting this green area are returned. */
  greenAreaId?: number
  /** Optional EPSG:4326 POLYGON/MULTIPOLYGON WKT (draw-on-map clip). */
  clipWkt?: string
}

export function buildGreenAssetViewportQuery(
  params: GreenAssetViewportParams
): string {
  const search = new URLSearchParams()
  search.set('bbox', params.bbox.map((v) => v.toFixed(6)).join(','))
  search.set('zoom', String(params.zoom))
  if (params.regionId != null) search.set('region_id', String(params.regionId))
  if (params.provinceId != null)
    search.set('province_id', String(params.provinceId))
  if (params.municipalityId != null)
    search.set('municipality_id', String(params.municipalityId))
  if (params.subMunicipalAreaId != null)
    search.set('sub_municipal_area_id', String(params.subMunicipalAreaId))
  if (params.greenAreaId != null)
    search.set('green_area_id', String(params.greenAreaId))
  if (params.clipWkt) search.set('clip_wkt', params.clipWkt)
  search.set('format', 'geobuf')
  return search.toString()
}

export interface GreenAssetsApi {
  /** Viewport-sized response: raw assets or server-side grid clusters (bbox+zoom). */
  getGreenAssetsViewport: (
    params: GreenAssetViewportParams
  ) => Promise<GeoJSONFeatureCollection>
}

export type GreenAssetsApiOptions = FetcherOptions

export function createGreenAssetsApi(
  options: GreenAssetsApiOptions = {}
): GreenAssetsApi {
  const { baseUrl = API_URL, fetchFn = fetch } = options
  const { fetchGeobufOrEmpty } = createFetcher(baseUrl, fetchFn)

  return {
    getGreenAssetsViewport: async (
      params: GreenAssetViewportParams
    ): Promise<GeoJSONFeatureCollection> => {
      try {
        const path = `/api/territory/green-assets/viewport?${buildGreenAssetViewportQuery(params)}`
        return fetchGeobufOrEmpty(path)
      } catch {
        return EMPTY_GEOJSON
      }
    },
  }
}
