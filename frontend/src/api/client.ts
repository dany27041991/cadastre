/**
 * Shared API client: GeoJSON type and fetcher.
 * Used by territory, green areas and green assets APIs.
 */
import Pbf from 'pbf'
import * as geobuf from 'geobuf'

export type GeoJSONFeatureCollection = {
  type: 'FeatureCollection'
  features: Array<{
    type: 'Feature'
    id: number
    properties: Record<string, unknown>
    geometry: object
  }>
}

export const EMPTY_GEOJSON: GeoJSONFeatureCollection = {
  type: 'FeatureCollection',
  features: [],
}

export type Fetcher = {
  fetchGeoJson: (path: string) => Promise<GeoJSONFeatureCollection>
  fetchGeoJsonOrEmpty: (path: string) => Promise<GeoJSONFeatureCollection>
  /** Fetch GeoBuf binary, decode to GeoJSON. Use path with ?format=geobuf */
  fetchGeobufOrEmpty: (path: string) => Promise<GeoJSONFeatureCollection>
}

export function createFetcher(
  baseUrl: string,
  fetchFn: (url: string) => Promise<Response> = fetch
): Fetcher {
  const fullUrl = (path: string) =>
    path.startsWith('http') ? path : `${baseUrl.replace(/\/$/, '')}${path}`

  return {
    fetchGeoJson: async (path: string) => {
      const res = await fetchFn(fullUrl(path))
      if (!res.ok) throw new Error(res.statusText)
      return res.json()
    },
    fetchGeoJsonOrEmpty: async (path: string) => {
      const res = await fetchFn(fullUrl(path))
      if (res.status === 404) return EMPTY_GEOJSON
      if (!res.ok) throw new Error(res.statusText)
      return res.json()
    },
    fetchGeobufOrEmpty: async (path: string) => {
      const res = await fetchFn(fullUrl(path))
      if (res.status === 404) return EMPTY_GEOJSON
      if (!res.ok) throw new Error(res.statusText)
      const buf = await res.arrayBuffer()
      if (buf.byteLength === 0) return EMPTY_GEOJSON
      const geojson = geobuf.decode(new Pbf(buf)) as GeoJSONFeatureCollection
      return geojson ?? EMPTY_GEOJSON
    },
  }
}
