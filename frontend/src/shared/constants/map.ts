/** Configurazione mappa e API. */

export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

/** Centro Italia in EPSG:4326 (lon, lat). */
export const ITALY_CENTER: [number, number] = [12.5, 41.9]

/** Zoom iniziale per vista Italia. */
export const ITALY_ZOOM = 6
