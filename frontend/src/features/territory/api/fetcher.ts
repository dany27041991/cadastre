/**
 * Geobuf fetcher and decoding for territory map APIs.
 * Uses shared GeoJSON type and centralized error normalization.
 */
import Pbf from 'pbf'
import * as geobuf from 'geobuf'
import { toast } from 'react-toastify'
import type { GeoJSONFeatureCollection } from '@/shared/types'
import { normalizeApiError } from '@/shared/lib/errors'
import { i18n } from '@/shared/i18n'

export type { GeoJSONFeatureCollection } from '@/shared/types'

export const EMPTY_GEOJSON: GeoJSONFeatureCollection = {
  type: 'FeatureCollection',
  features: [],
}

const CLUSTER_OVER_CAP_HEADER = 'x-cadastre-cluster-over-cap'
let lastOverCapToastAt = 0

function maybeToastClusterOverCap(res: Response): void {
  if (res.headers.get(CLUSTER_OVER_CAP_HEADER) !== '1') return
  const now = Date.now()
  if (now - lastOverCapToastAt < 8_000) return
  lastOverCapToastAt = now
  toast.info(i18n.t('territory.panel.draw.clusterOverCap'))
}

export type Fetcher = {
  fetchGeoJson: (path: string) => Promise<GeoJSONFeatureCollection>
  fetchGeoJsonOrEmpty: (path: string) => Promise<GeoJSONFeatureCollection>
  fetchGeobufOrEmpty: (path: string) => Promise<GeoJSONFeatureCollection>
}

/** Options for API clients that use this fetcher (baseUrl, fetchFn). */
export type FetcherOptions = {
  baseUrl?: string
  fetchFn?: (url: string) => Promise<Response>
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
      if (!res.ok) throw new Error(normalizeApiError(res).message)
      return res.json()
    },
    fetchGeoJsonOrEmpty: async (path: string) => {
      const res = await fetchFn(fullUrl(path))
      if (res.status === 404) return EMPTY_GEOJSON
      if (!res.ok) throw new Error(normalizeApiError(res).message)
      return res.json()
    },
    fetchGeobufOrEmpty: async (path: string) => {
      const res = await fetchFn(fullUrl(path))
      if (res.status === 404) return EMPTY_GEOJSON
      if (!res.ok) throw new Error(normalizeApiError(res).message)
      maybeToastClusterOverCap(res)
      const buf = await res.arrayBuffer()
      if (buf.byteLength === 0) return EMPTY_GEOJSON
      try {
        const geojson = geobuf.decode(new Pbf(buf)) as GeoJSONFeatureCollection
        return geojson ?? EMPTY_GEOJSON
      } catch {
        return EMPTY_GEOJSON
      }
    },
  }
}
