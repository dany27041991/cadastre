import type { GeoJSONFeatureCollection } from '@/shared/types'
import type { GeoinsightAdapterHost } from '../geoinsightAdapterHost'

/** Fetches viewport-sized data from the server (bbox+zoom → raw assets or clusters). */
export type GreenViewportFetcher = (
  bbox: [number, number, number, number],
  zoom: number
) => Promise<GeoJSONFeatureCollection>

export interface GeoinsightGreenClusterHost extends GeoinsightAdapterHost {
  greenAssetClusteringActive: boolean
  lastAppliedGreenAssetZoom: number | null
  lastGreenShowClusterCountLabels: boolean
  lastAppliedViewportBbox: [number, number, number, number] | null
  lastAppliedRawMode: boolean
  /** Server viewport mode: when set, data comes per-bbox from the backend. */
  greenViewportFetcher: GreenViewportFetcher | null
  /** Optional companion fetcher: root green areas (polygons) per bbox+zoom. */
  greenViewportAreasFetcher: GreenViewportFetcher | null
  /** Monotonic id to drop stale viewport responses (out-of-order fetches). */
  greenViewportRequestSeq: number
}
