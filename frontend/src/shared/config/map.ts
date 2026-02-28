/** Shared map and API config (used by territory feature). */

export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

/** Italy center in EPSG:4326 (lon, lat). */
export const ITALY_CENTER: [number, number] = [12.5, 41.9]

/** Initial zoom for Italy view. */
export const ITALY_ZOOM = 6

/** GeoJSON CRS: input (WGS84) and map display (Web Mercator). */
export const GEOJSON_DATA_PROJECTION = 'EPSG:4326'
export const GEOJSON_FEATURE_PROJECTION = 'EPSG:3857'
