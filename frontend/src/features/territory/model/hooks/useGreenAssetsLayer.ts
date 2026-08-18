/**
 * Green assets map layer (trees, rows, lawns): toggle + fetch logic.
 * Available at every administrative level: with an empty breadcrumb the
 * clusters cover the whole national territory; each breadcrumb selection
 * narrows the scope (region, province, municipality, sub-municipal area).
 *
 * Companion green-area polygons in viewport mode are optional and follow the
 * same zoom gate as before (GREEN_AREAS_VIEWPORT_MIN_ZOOM on the adapter).
 * When assets are on, areas are fetched only if `areasLayerActive` is true.
 * When assets are off and areas are on, an areas-only viewport mode keeps the
 * area polygons visible (same zoom gate).
 */
import { useState, useCallback, useEffect, useRef, useMemo } from 'react'
import type { GeoJSONFeatureCollection } from '@/shared/types'
import { territoryApi } from '../../api/territory.api'
import type { BreadcrumbCrumb, GreenContext } from '../../types'
import {
  getGreenContext,
  greenContextKey,
  isGreenMapLevel,
} from '../../lib/greenMapContext'
import { fetchGreenAreasForDrillScope } from '../../lib/greenAreaDrill'
import { LEVEL_SUB_AREAS } from '../constants'

const EMPTY_FEATURE_COLLECTION: GeoJSONFeatureCollection = {
  type: 'FeatureCollection',
  features: [],
}

export interface UseGreenAssetsLayerOptions {
  readonly breadcrumb: BreadcrumbCrumb[]
  readonly level: string
  /** Server viewport mode loader: data arrives per bbox+zoom from the backend. */
  readonly loadGreenLayerViewport: (
    fetcher: (
      bbox: [number, number, number, number],
      zoom: number
    ) => Promise<GeoJSONFeatureCollection>,
    areasFetcher?: (
      bbox: [number, number, number, number],
      zoom: number
    ) => Promise<GeoJSONFeatureCollection>
  ) => void
  readonly setGreenLayerVisible: (visible: boolean) => void
  readonly clearGreenLayer: () => void
  readonly restoreGreenAreas?: (options?: { skipFit?: boolean }) => Promise<void>
  readonly fitToGreenExtent: () => void
  readonly setTerritoryFillVisible: (visible: boolean) => void
  readonly onBeforeLoadingAssets?: () => void
  readonly assetsLayerActive: boolean
  readonly onAssetsLayerActiveChange: (active: boolean) => void
  /** Independent green-areas toggle. */
  readonly areasLayerActive: boolean
  readonly onAreasLayerActiveChange: (active: boolean) => void
  /** Draw-on-map clip WKT; omit for Area Italia (no clip_wkt on the wire). */
  readonly clipWkt?: string | null
  /** When true, never fetch viewport without a clip (avoids nationwide leak on redraw). */
  readonly clipRequired?: boolean
}

export interface UseGreenAssetsLayerResult {
  readonly loading: boolean
  readonly available: boolean
  readonly setAssetsActive: (active: boolean) => void
  readonly setAreasActive: (active: boolean) => void
}

type ViewportFetcher = UseGreenAssetsLayerOptions['loadGreenLayerViewport']

function scopeFromContext(context: GreenContext) {
  return {
    regionId: context.regionId,
    provinceId: context.provinceId,
    municipalityId: context.municipalityId,
    subMunicipalAreaId: context.subMunicipalAreaId,
  }
}

function areasFetcherFor(context: GreenContext, clipWkt?: string | null) {
  const scope = scopeFromContext(context)
  const greenAreaId = context.greenAreaId
  // After Esplodi / Seleziona: keep companion areas inside the drilled scope
  // (viewport roots would re-show every municipality area).
  if (
    greenAreaId != null &&
    scope.regionId != null &&
    scope.provinceId != null
  ) {
    return async () =>
      fetchGreenAreasForDrillScope(
        territoryApi.getGreenAreas,
        greenAreaId,
        scope.regionId as number,
        scope.provinceId as number,
        scope.municipalityId
      )
  }
  return (bbox: [number, number, number, number], zoom: number) =>
    territoryApi.getGreenAreasViewport({
      bbox,
      zoom,
      ...scope,
      ...(clipWkt ? { clipWkt } : {}),
    })
}

function startViewportMode(
  context: GreenContext,
  loadGreenLayerViewport: ViewportFetcher,
  includeAreas: boolean,
  clipWkt?: string | null
): void {
  const scope = scopeFromContext(context)
  const greenAreaId = context.greenAreaId
  const assetsFetcher = (bbox: [number, number, number, number], zoom: number) =>
    territoryApi.getGreenAssetsViewport({
      bbox,
      zoom,
      greenAreaId,
      ...scope,
      ...(clipWkt ? { clipWkt } : {}),
    })
  loadGreenLayerViewport(
    assetsFetcher,
    includeAreas ? areasFetcherFor(context, clipWkt) : undefined
  )
}

/** Assets off + areas on: keep area polygons via empty assets + areas companion. */
function startAreasOnlyViewportMode(
  context: GreenContext,
  loadGreenLayerViewport: ViewportFetcher,
  clipWkt?: string | null
): void {
  const emptyAssets = async () => EMPTY_FEATURE_COLLECTION
  loadGreenLayerViewport(emptyAssets, areasFetcherFor(context, clipWkt))
}

export function useGreenAssetsLayer(options: UseGreenAssetsLayerOptions): UseGreenAssetsLayerResult {
  const {
    breadcrumb,
    level,
    loadGreenLayerViewport,
    setGreenLayerVisible,
    clearGreenLayer,
    fitToGreenExtent,
    onBeforeLoadingAssets,
    assetsLayerActive,
    onAssetsLayerActiveChange,
    areasLayerActive,
    onAreasLayerActiveChange,
    clipWkt = null,
    clipRequired = false,
  } = options

  const [loading, setLoading] = useState(false)
  const lastContextKeyRef = useRef<string | null>(null)
  const areasLayerActiveRef = useRef(areasLayerActive)
  areasLayerActiveRef.current = areasLayerActive
  const assetsLayerActiveRef = useRef(assetsLayerActive)
  assetsLayerActiveRef.current = assetsLayerActive

  const context = useMemo(() => getGreenContext(breadcrumb), [breadcrumb])
  const contextKey = useMemo(
    () => `${greenContextKey(context)}#${clipWkt ?? ''}`,
    [context, clipWkt]
  )
  const clipReady = !clipRequired || Boolean(clipWkt)
  const greenLevel = isGreenMapLevel(level)

  const turnOffAssetsLayer = useCallback(async () => {
    // Sync ref before React re-render so the assets follow-effect cannot
    // restart viewport while assetsLayerActive prop is still true.
    assetsLayerActiveRef.current = false
    onAssetsLayerActiveChange(false)
    if (areasLayerActiveRef.current) {
      if (!clipReady) {
        setGreenLayerVisible(false)
        clearGreenLayer()
        lastContextKeyRef.current = contextKey
        return
      }
      setLoading(true)
      startAreasOnlyViewportMode(context, loadGreenLayerViewport, clipWkt)
      setGreenLayerVisible(true)
      lastContextKeyRef.current = contextKey
      setLoading(false)
      return
    }
    setGreenLayerVisible(false)
    clearGreenLayer()
    // Do not null lastContextKey before clear: that window let the follow-effect
    // treat the next pass as a context change and remount asset clusters.
    lastContextKeyRef.current = contextKey
  }, [
    context,
    contextKey,
    clipWkt,
    clipReady,
    loadGreenLayerViewport,
    setGreenLayerVisible,
    clearGreenLayer,
    onAssetsLayerActiveChange,
  ])

  const loadAssetsForContext = useCallback(async () => {
    if (!clipReady) return false
    if (greenLevel) {
      onBeforeLoadingAssets?.()
    }
    setLoading(true)
    assetsLayerActiveRef.current = true
    lastContextKeyRef.current = contextKey
    startViewportMode(context, loadGreenLayerViewport, areasLayerActiveRef.current, clipWkt)
    setGreenLayerVisible(true)
    onAssetsLayerActiveChange(true)
    setLoading(false)
    return true
  }, [
    context,
    contextKey,
    clipWkt,
    clipReady,
    greenLevel,
    loadGreenLayerViewport,
    setGreenLayerVisible,
    onAssetsLayerActiveChange,
    onBeforeLoadingAssets,
  ])

  // Follow breadcrumb while assets viewport is active.
  useEffect(() => {
    if (!assetsLayerActive || !assetsLayerActiveRef.current) return
    if (!clipReady) {
      setGreenLayerVisible(false)
      clearGreenLayer()
      lastContextKeyRef.current = contextKey
      return
    }
    if (contextKey === lastContextKeyRef.current) return

    lastContextKeyRef.current = contextKey
    if (greenLevel) {
      onBeforeLoadingAssets?.()
    }
    setLoading(true)
    // Includes sub_areas: greenAreaId scopes clusters/trees to the drilled area.
    startViewportMode(context, loadGreenLayerViewport, areasLayerActiveRef.current, clipWkt)
    setGreenLayerVisible(true)
    // Preserve zoom on sub-area drill — fitting children bbox often zooms out.
    if (greenLevel && level !== LEVEL_SUB_AREAS) {
      fitToGreenExtent()
    }
    setLoading(false)
  }, [
    assetsLayerActive,
    contextKey,
    context,
    level,
    greenLevel,
    loadGreenLayerViewport,
    setGreenLayerVisible,
    fitToGreenExtent,
    onBeforeLoadingAssets,
    clipReady,
    clipWkt,
    clearGreenLayer,
  ])

  // Follow breadcrumb while areas-only viewport is active (assets off).
  useEffect(() => {
    if (assetsLayerActive || !areasLayerActive) return
    if (!clipReady) {
      setGreenLayerVisible(false)
      clearGreenLayer()
      lastContextKeyRef.current = contextKey
      return
    }
    if (contextKey === lastContextKeyRef.current) return

    lastContextKeyRef.current = contextKey
    setLoading(true)
    // Scoped via greenAreaId when at sub_areas (areasFetcherFor).
    startAreasOnlyViewportMode(context, loadGreenLayerViewport, clipWkt)
    setGreenLayerVisible(true)
    setLoading(false)
  }, [
    assetsLayerActive,
    areasLayerActive,
    contextKey,
    context,
    loadGreenLayerViewport,
    setGreenLayerVisible,
    clipReady,
    clipWkt,
    clearGreenLayer,
  ])

  const setAssetsActive = useCallback(
    async (active: boolean) => {
      if (loading) return
      if (active) {
        if (assetsLayerActive) return
        await loadAssetsForContext()
        return
      }
      if (!assetsLayerActive) return
      await turnOffAssetsLayer()
    },
    [loading, assetsLayerActive, loadAssetsForContext, turnOffAssetsLayer]
  )

  const setAreasActive = useCallback(
    async (active: boolean) => {
      if (loading) return
      if (active === areasLayerActive) return
      onAreasLayerActiveChange(active)
      // Keep ref in sync immediately so turnOffAssetsLayer does not restart areas-only.
      areasLayerActiveRef.current = active

      if (assetsLayerActive) {
        if (!clipReady) {
          setGreenLayerVisible(false)
          clearGreenLayer()
          lastContextKeyRef.current = contextKey
          return
        }
        setLoading(true)
        startViewportMode(context, loadGreenLayerViewport, active, clipWkt)
        setGreenLayerVisible(true)
        lastContextKeyRef.current = contextKey
        setLoading(false)
        return
      }

      if (active) {
        if (!clipReady) {
          setGreenLayerVisible(false)
          clearGreenLayer()
          lastContextKeyRef.current = contextKey
          return
        }
        setLoading(true)
        startAreasOnlyViewportMode(context, loadGreenLayerViewport, clipWkt)
        setGreenLayerVisible(true)
        lastContextKeyRef.current = contextKey
        setLoading(false)
        return
      }
      lastContextKeyRef.current = null
      setGreenLayerVisible(false)
      clearGreenLayer()
    },
    [
      loading,
      areasLayerActive,
      assetsLayerActive,
      onAreasLayerActiveChange,
      context,
      contextKey,
      clipWkt,
      clipReady,
      loadGreenLayerViewport,
      setGreenLayerVisible,
      clearGreenLayer,
    ]
  )

  return { loading, available: true, setAssetsActive, setAreasActive }
}
