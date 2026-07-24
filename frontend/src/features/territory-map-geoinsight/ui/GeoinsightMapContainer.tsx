/**
 * Geoinsight map container — cu1.5 Map.tsx contract + SIV territory bridge.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { Geoinsight, useRefGeoinsight } from '@mase/commons-geoinsight'
import { geoinsightConfig } from '@/app/config/geoinsight'
import { useGeoinsightStore } from '@/app/store/useGeoinsightStore'
import { useTranslation } from 'react-i18next'
import { Loader, Text } from 'dxc-webkit'
import { parseZoomFromCenterScale } from '../model/parseMapZoom'

import { createGeoinsightMapStyle } from './geoinsightMapStyle'
import {
  dedupeGeoinsightMapPanels,
  injectMapDrawHandleStyles,
  startGeoinsightMapPanelDedupeObserver,
} from './injectMapDrawHandleStyles'

const mapStyle = createGeoinsightMapStyle()

/** Min zoom delta before syncing store / triggering cluster pipeline. */
const MAP_ZOOM_SYNC_EPSILON = 0.02

/**
 * Poll map center+zoom on a light interval. Zoom widget buttons (+/-) and wheel
 * animations change the view without pointer events over the canvas, and the vendor
 * bundle does not re-emit `moveend`; polling is the only reliable settle signal.
 */
/**
 * Pan latency chain is poll -> pan debounce -> apply debounce; the three stages
 * summed to ~300ms before edge assets appeared (debug logs). 80+60+40 keeps the
 * same coalescing behaviour at ~180ms worst case.
 */
const MAP_STATE_POLL_MS = 80

/** Debounce pan viewport refresh (raw mode asset culling). */
const MAP_VIEW_PAN_DEBOUNCE_MS = 60

/** Show the loader only when a viewport refresh outlives this delay (no flicker
 * on the typical 80-250ms fetches; visible on render-contended or slow ones). */
const GREEN_LOADING_SHOW_DELAY_MS = 250

/**
 * Non-blocking loading badge for green viewport refreshes. Fetch resolution can
 * lag well past the server response while the main thread renders the map
 * (measured up to 2s); this tells the user data is on its way.
 */
function GreenViewportLoadingBadge() {
  const { t } = useTranslation()
  const loading = useGeoinsightStore((state) => state.greenViewportLoadingCount > 0)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (!loading) {
      setVisible(false)
      return
    }
    const timer = setTimeout(() => setVisible(true), GREEN_LOADING_SHOW_DELAY_MS)
    return () => clearTimeout(timer)
  }, [loading])

  if (!visible) return null
  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 15,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '0.75rem',
        pointerEvents: 'none',
      }}
    >
      <div
        style={{
          // The injected map-shell CSS ([aria-label="Map view"] > div > div > div)
          // forces absolute inset-0 full-size on nested divs; opt this pill out so
          // it stays content-sized and vertically centered.
          position: 'relative',
          inset: 'auto',
          width: 'auto',
          height: 'auto',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '0.75rem',
          padding: '1.25rem 1.75rem',
          background: 'rgba(212, 237, 218, 0.85)',
          borderRadius: '1rem',
          boxShadow: '0 1px 4px rgba(0,0,0,0.25)',
        }}
      >
        <Loader
          type="circle"
          size="lg"
          value={50}
          showPercentage={false}
          className="green-circle-loader"
        />
        <Text font="f1-body-md" style={{ fontWeight: 600, color: 'var(--success)' }}>
          {t('territory.loading')}
        </Text>
      </div>
    </div>
  )
}

export interface GeoinsightMapContainerProps {
  readonly onFeatureInfo: (event: unknown) => void
  readonly onDrawnGeometryInfo?: (
    mapId: number,
    coordinates: number[],
    epsg: string,
    features: unknown[]
  ) => void
  readonly onReady?: () => void
}

export function GeoinsightMapContainer({
  onFeatureInfo,
  onDrawnGeometryInfo,
  onReady,
}: GeoinsightMapContainerProps) {
  const { ref } = useRefGeoinsight()
  const initError = useGeoinsightStore((state) => state.initError)
  const isMapReady = useGeoinsightStore((state) => state.isMapReady)
  const panViewTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastPolledViewRef = useRef<{ zoom: number | null; cx: number | null; cy: number | null }>({
    zoom: null,
    cx: null,
    cy: null,
  })

  const enforceSingleMapView = useCallback(() => {
    dedupeGeoinsightMapPanels()
    ref.current?.setMapActive?.(geoinsightConfig.mapId)
  }, [ref])

  useEffect(() => {
    useGeoinsightStore.getState().setGeoinsightRef(ref)
    startGeoinsightMapPanelDedupeObserver()
  }, [ref])

  useEffect(() => {
    return () => {
      useGeoinsightStore.getState().setGeoinsightRef(null)
      useGeoinsightStore.getState().setIsMapReady(false)
      useGeoinsightStore.getState().setInitError(null)
      if (panViewTimerRef.current != null) clearTimeout(panViewTimerRef.current)
    }
  }, [])

  const scheduleMapViewRefresh = useCallback(() => {
    if (panViewTimerRef.current != null) clearTimeout(panViewTimerRef.current)
    panViewTimerRef.current = setTimeout(() => {
      panViewTimerRef.current = null
      useGeoinsightStore.getState().bumpMapViewEpoch()
    }, MAP_VIEW_PAN_DEBOUNCE_MS)
  }, [])

  const readMapZoom = useCallback(() => {
    const result = ref.current?.getCenterAndScale?.(geoinsightConfig.mapId)
    return parseZoomFromCenterScale(result)
  }, [ref])

  const publishMapZoom = useCallback((zoom: number) => {
    const prev = useGeoinsightStore.getState().mapZoom
    if (prev != null && Math.abs(zoom - prev) < MAP_ZOOM_SYNC_EPSILON) return
    useGeoinsightStore.getState().setMapZoom(zoom)
  }, [])

  const syncMapZoom = useCallback(() => {
    const zoom = readMapZoom()
    if (zoom != null) publishMapZoom(zoom)
  }, [readMapZoom, publishMapZoom])

  // Poll-based view watcher: zoom widget buttons and wheel animations change the view
  // without pointer events over the canvas, so pointer callbacks alone miss them.
  useEffect(() => {
    if (!isMapReady) return
    const interval = setInterval(() => {
      const status = ref.current?.getCenterAndScale?.(geoinsightConfig.mapId)
      const zoom = parseZoomFromCenterScale(status)
      const center = (status as { center?: number[] } | undefined)?.center
      const cx = center?.[0] ?? null
      const cy = center?.[1] ?? null
      const prev = lastPolledViewRef.current
      lastPolledViewRef.current = { zoom, cx, cy }
      if (zoom == null) return

      const published = useGeoinsightStore.getState().mapZoom
      if (published == null || Math.abs(zoom - published) >= MAP_ZOOM_SYNC_EPSILON) {
        // Zoom-only update: the mapZoom store effect drives a fullReplace cluster
        // refresh. Do not also bump mapViewEpoch — that pan path shares the apply
        // timer and can cancel the zoom settle (leaving stale clusters on zoom-out
        // when the center has not moved).
        publishMapZoom(zoom)
        return
      }

      const wasMoving = prev.zoom !== zoom || prev.cx !== cx || prev.cy !== cy
      if (wasMoving) scheduleMapViewRefresh()
    }, MAP_STATE_POLL_MS)
    return () => clearInterval(interval)
  }, [isMapReady, ref, publishMapZoom, scheduleMapViewRefresh])

  const handleGenericEvent = useCallback(
    (eventName: string, _event: CustomEvent) => {
      if (eventName === 'ready') {
        useGeoinsightStore.getState().setGeoinsightRef(ref)
        const result = ref.current?.getCenterAndScale?.(geoinsightConfig.mapId)
        if (result?.epsg) useGeoinsightStore.getState().setCrs(result.epsg)
        syncMapZoom()
        useGeoinsightStore.getState().setIsMapReady(true)
        ref.current?.setGeometryLabelVisibility?.(geoinsightConfig.mapId, false)
        injectMapDrawHandleStyles()
        enforceSingleMapView()
        onReady?.()
        return
      }
    },
    [ref, onReady, syncMapZoom, enforceSingleMapView]
  )

  const onPointerCoordsChange = useCallback(
    (_mapId: number, epsg: string, _coords: string) => {
      const crs = useGeoinsightStore.getState().crs
      if (crs !== epsg) useGeoinsightStore.getState().setCrs(epsg)
    },
    []
  )

  return (
    <>
      <GreenViewportLoadingBadge />
      {initError ? (
        <div
          role="alert"
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: 20,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1.5rem',
            background: 'rgba(255,255,255,0.92)',
            textAlign: 'center',
          }}
        >
          <div>
            <p style={{ margin: 0, fontWeight: 600 }}>Mappa Geoinsight non disponibile</p>
            <p style={{ margin: '0.75rem 0 0', maxWidth: '36rem' }}>{initError}</p>
          </div>
        </div>
      ) : null}
      <Geoinsight
        webgis_id={geoinsightConfig.webgisId}
        cu_id={geoinsightConfig.cuId}
        ref={ref}
        style={mapStyle}
        onGetFeatureInfo={onFeatureInfo}
        onDrawnGeometryInfo={onDrawnGeometryInfo}
        onPointerCoordsChange={onPointerCoordsChange}
        onGenericEvent={{
          events: ['ready'],
          callbackFunction: handleGenericEvent,
        }}
      />
    </>
  )
}
