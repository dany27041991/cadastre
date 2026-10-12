/**
 * Green assets map API: GeoJSON layer for territory map (trees, rows, lawns, etc.).
 * Endpoint: GET /api/territory/green-assets/viewport
 */
import { API_URL } from '@/shared/config/map'
import {
  AREA_FILTER_QUERY_PREFIX,
  appendAppliedFilters,
} from '../lib/appendAppliedFilters'
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
  /** Ingest window (ISO YYYY-MM-DD); required by BE (lakehouse-only). */
  dateFrom?: string
  dateTo?: string
  /** Applied InfoPanel asset column filters (Cerca commit). */
  filters?: Readonly<Record<string, string>>
  /**
   * Applied area column filters — constrain assets to matching managed areas
   * (serialized as ``area__*`` query params).
   */
  areaFilters?: Readonly<Record<string, string>>
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
  if (params.dateFrom) search.set('date_from', params.dateFrom)
  if (params.dateTo) search.set('date_to', params.dateTo)
  appendAppliedFilters(search, params.filters)
  appendAppliedFilters(search, params.areaFilters, AREA_FILTER_QUERY_PREFIX)
  search.set('format', 'geobuf')
  return search.toString()
}

export interface GreenAssetsApi {
  /** Viewport-sized response: raw assets or server-side grid clusters (bbox+zoom). */
  getGreenAssetsViewport: (
    params: GreenAssetViewportParams,
    init?: RequestInit,
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
      params: GreenAssetViewportParams,
      init?: RequestInit,
    ): Promise<GeoJSONFeatureCollection> => {
      try {
        const path = `/api/territory/green-assets/viewport?${buildGreenAssetViewportQuery(params)}`
        const collection = await fetchGeobufOrEmpty(path, init)
        return collection
      } catch (err) {
        if (init?.signal?.aborted) throw err
        // #region agent log
        fetch('http://127.0.0.1:7455/ingest/ee4d7135-3aef-4e11-b07a-3de89c3bf62c',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'4fe799'},body:JSON.stringify({sessionId:'4fe799',runId:'villa-clusters',hypothesisId:'H-api-swallow',location:'greenAssetMap.api:viewport',message:'assets_viewport_api_err',data:{err:String(err),zoom:params.zoom,hasAreaFilters:!!params.areaFilters},timestamp:Date.now()})}).catch(()=>{})
        // #endregion
        // NetworkError must surface as transportFail (debug 4fe799 name=area).
        if (/NetworkError|Failed to fetch/i.test(String(err))) throw err
        // Other 500 / pool: keep map usable; next settle refresh retries.
        return EMPTY_GEOJSON
      }
    },
  }
}
