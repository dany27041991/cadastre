/**
 * Geoinsight map ref, readiness, and viewport state (cu1.5 useMapStore subset).
 */
import { create } from 'zustand'
import type { GeoinsightRef } from '@mase/commons-geoinsight'
import type { RefObject } from 'react'

export type GeoinsightRefHandle = RefObject<GeoinsightRef | null>

interface GeoinsightStoreState {
  geoinsightRef: GeoinsightRefHandle | null
  isMapReady: boolean
  initError: string | null
  mapFocus: boolean
  crs: string
  mapZoom: number | null
  /** Bumped when pan/zoom settles without zoom value change (viewport culling refresh). */
  mapViewEpoch: number
  /** In-flight green viewport fetches (drives the map loading indicator). */
  greenViewportLoadingCount: number
  setGeoinsightRef: (ref: GeoinsightRefHandle | null) => void
  setIsMapReady: (ready: boolean) => void
  setInitError: (message: string | null) => void
  setMapFocus: (focus: boolean) => void
  setCrs: (crs: string) => void
  setMapZoom: (zoom: number | null) => void
  bumpMapViewEpoch: () => void
  beginGreenViewportLoad: () => void
  endGreenViewportLoad: () => void
}

export const useGeoinsightStore = create<GeoinsightStoreState>((set) => ({
  geoinsightRef: null,
  isMapReady: false,
  initError: null,
  mapFocus: false,
  crs: 'EPSG:3857',
  mapZoom: null,
  mapViewEpoch: 0,
  greenViewportLoadingCount: 0,
  setGeoinsightRef: (geoinsightRef) => set({ geoinsightRef }),
  setIsMapReady: (isMapReady) => set({ isMapReady }),
  setInitError: (initError) => set({ initError }),
  setMapFocus: (mapFocus) => set({ mapFocus }),
  setCrs: (crs) => set({ crs }),
  setMapZoom: (mapZoom) => set({ mapZoom }),
  bumpMapViewEpoch: () => set((state) => ({ mapViewEpoch: state.mapViewEpoch + 1 })),
  beginGreenViewportLoad: () =>
    set((state) => ({ greenViewportLoadingCount: state.greenViewportLoadingCount + 1 })),
  endGreenViewportLoad: () =>
    set((state) => ({
      greenViewportLoadingCount: Math.max(0, state.greenViewportLoadingCount - 1),
    })),
}))
