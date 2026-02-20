/**
 * Territory API contracts (shared).
 * api/territory implements these; shared never imports from api.
 */
import type { GeoJSONFeatureCollection } from '../geojson'

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

export interface GreenAreasParams {
  regionId: number
  parentId?: number
  municipalityId?: number
  districtId?: number
}

export interface TerritoryGreenAreasApi {
  getGreenAreas: (
    params: GreenAreasParams
  ) => Promise<GeoJSONFeatureCollection>
}

/** Geo + green areas: used by navigation loaders. */
export type TerritoryNavigationApi = TerritoryGeoApi & TerritoryGreenAreasApi
