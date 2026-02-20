/**
 * Barrel: API territorio (geo, aree verdi, asset verdi).
 */
export {
  territoryApi,
  createTerritoryApi,
  EMPTY_GEOJSON,
  createFetcher,
  buildGreenAreasQuery,
  buildGreenAssetQuery,
} from './territory'
export type {
  GeoJSONFeatureCollection,
  Fetcher,
  TerritoryGeoApi,
  TerritoryGreenAreasApi,
  TerritoryGreenAssetsApi,
  TerritoryNavigationApi,
  TerritoryApi,
  TerritoryApiOptions,
  GreenAreasParams,
  GreenAssetParams,
} from './territory'
