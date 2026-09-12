/**
 * Panel mode: click-freeze, Area Italia / Monitoraggio, table queries, landing reset.
 */
import { useCallback, useEffect, useMemo, useRef } from 'react'
import {
  buildGreenAreasTableQuery,
  buildGreenAssetsTableQuery,
} from '@/features/territory/lib/greenTableParams'
import { polygonToWkt } from '@/features/territory/lib/spatialClipWkt'
import type { SpatialClipPolygon } from '@/features/territory/lib/spatialClipWkt'
import type { BreadcrumbCrumb, TerritoryLevel } from '@/features/territory/types'
import type {
  TerritoryEntryMode,
  TerritorySearchNavControls,
} from '@/features/territory/context/GreenTablePanelContext'
import type { UseGeoinsightMapBridgeResult } from '@/features/territory-map-geoinsight'

export type UseTerritoryMapPanelModeArgs = {
  map: UseGeoinsightMapBridgeResult
  entryMode: TerritoryEntryMode
  spatialClip: SpatialClipPolygon | null
  layersPanelOpen: boolean
  greenAssetsLayerActive: boolean
  greenAreasLayerActive: boolean
  level: TerritoryLevel
  breadcrumb: BreadcrumbCrumb[]
  dateFromIso: string
  dateToIso: string
  loadRegions: TerritorySearchNavControls['loadRegions'] &
    ((options?: { fit?: boolean; mountTerritory?: boolean }) => Promise<void> | void)
  jumpToSearchHit: TerritorySearchNavControls['jumpToSearchHit']
  navLoading: boolean
  openGreenAreaDetail: TerritorySearchNavControls['openGreenAreaDetail']
  closeGreenDetail: TerritorySearchNavControls['closeGreenDetail']
  deactivateLayerToggles: () => void
  resetPanelState: () => void
  setAdminTerritoryReady: (ready: boolean) => void
  registerResetToLanding: (fn: (() => void) | null) => void
  registerTerritorySearchNav: (nav: TerritorySearchNavControls | null) => void
}

export function useTerritoryMapPanelMode({
  map,
  entryMode,
  spatialClip,
  layersPanelOpen,
  greenAssetsLayerActive,
  greenAreasLayerActive,
  level,
  breadcrumb,
  dateFromIso,
  dateToIso,
  loadRegions,
  jumpToSearchHit,
  navLoading,
  openGreenAreaDetail,
  closeGreenDetail,
  deactivateLayerToggles,
  resetPanelState,
  setAdminTerritoryReady,
  registerResetToLanding,
  registerTerritorySearchNav,
}: UseTerritoryMapPanelModeArgs) {
  const layersPanelOpenRef = useRef(false)
  const loadRegionsRef = useRef(loadRegions)
  loadRegionsRef.current = loadRegions
  const mapRef = useRef(map)
  mapRef.current = map
  const entryModeRef = useRef(entryMode)
  entryModeRef.current = entryMode
  const prevLayersPanelOpenRef = useRef(layersPanelOpen)
  const closeGreenDetailRef = useRef(closeGreenDetail)
  closeGreenDetailRef.current = closeGreenDetail

  useEffect(() => {
    // Freeze admin territory click when green overlays are on (no jump).
    // Draw entry freezes clicks for the whole session (even with toggles off).
    // Green area/asset clicks always open the detail modal via adapter.
    const drawFreeze = entryMode === 'draw'
    map.setClickNavigationEnabled(
      !(drawFreeze || greenAssetsLayerActive || greenAreasLayerActive),
    )
  }, [map, greenAssetsLayerActive, greenAreasLayerActive, entryMode])

  const clipWkt = useMemo(() => {
    if (entryMode !== 'draw' || spatialClip == null) return null
    try {
      return polygonToWkt(spatialClip)
    } catch {
      return null
    }
  }, [entryMode, spatialClip])

  const areasTableQuery = useMemo(
    () =>
      buildGreenAreasTableQuery(level, breadcrumb, clipWkt, {
        dateFrom: dateFromIso,
        dateTo: dateToIso,
      }),
    [level, breadcrumb, clipWkt, dateFromIso, dateToIso],
  )
  const assetsTableQuery = useMemo(
    () =>
      buildGreenAssetsTableQuery(breadcrumb, clipWkt, {
        dateFrom: dateFromIso,
        dateTo: dateToIso,
      }),
    [breadcrumb, clipWkt, dateFromIso, dateToIso],
  )

  layersPanelOpenRef.current = layersPanelOpen

  // Monitoraggio → hide admin territories. Area Italia (layers) → load Italy once on enter.
  useEffect(() => {
    const open = layersPanelOpen
    const wasOpen = prevLayersPanelOpenRef.current
    prevLayersPanelOpenRef.current = open
    if (!open) {
      setAdminTerritoryReady(false)
      mapRef.current.clearTerritoryLayer()
      return
    }
    if (!wasOpen) {
      if (entryModeRef.current === 'draw') {
        // Draw entry has no admin territories to wait for.
        setAdminTerritoryReady(true)
        mapRef.current.clearTerritoryLayer()
        return
      }
      // Lock dates/search until regions are on the map; keep current zoom.
      setAdminTerritoryReady(false)
      mapRef.current.flushAdapterPending()
      void Promise.resolve(loadRegionsRef.current({ fit: false })).finally(() => {
        setAdminTerritoryReady(true)
      })
    }
  }, [layersPanelOpen, setAdminTerritoryReady])

  const resetToLanding = useCallback(() => {
    deactivateLayerToggles()
    closeGreenDetailRef.current()
    // Discard (do not restore/re-add) so red selection vanishes with the green layer.
    mapRef.current.discardGreenDetailHighlight()
    mapRef.current.clearGreenLayer()
    mapRef.current.setGreenLayerVisible(false)
    mapRef.current.deactivateDrawGeometry()
    mapRef.current.deleteAllDrawnGeometries()
    mapRef.current.clearSimpleDrawGeometries()
    mapRef.current.restoreSimpleDrawTools()
    mapRef.current.clearDrawClip()
    resetPanelState()
    layersPanelOpenRef.current = false
    // Reset breadcrumb/level to Italy and fit without mounting T_* (Monitoraggio).
    // Avoid load-then-clear: the deferred clearTerritoryLayer raced with Area Italia.
    void loadRegionsRef.current({ fit: true, mountTerritory: false } as {
      fit?: boolean
    })
  }, [resetPanelState, deactivateLayerToggles])

  useEffect(() => {
    registerResetToLanding(resetToLanding)
    return () => registerResetToLanding(null)
  }, [registerResetToLanding, resetToLanding])

  useEffect(() => {
    registerTerritorySearchNav({
      breadcrumb,
      jumpToSearchHit,
      loadRegions,
      loading: navLoading,
      openGreenAreaDetail,
      closeGreenDetail,
    })
    return () => registerTerritorySearchNav(null)
  }, [
    registerTerritorySearchNav,
    breadcrumb,
    jumpToSearchHit,
    loadRegions,
    navLoading,
    openGreenAreaDetail,
    closeGreenDetail,
  ])

  return {
    layersPanelOpenRef,
    clipWkt,
    areasTableQuery,
    assetsTableQuery,
  }
}
