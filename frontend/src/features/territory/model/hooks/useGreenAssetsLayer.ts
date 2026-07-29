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

function areasFetcherFor(context: GreenContext) {
  const scope = scopeFromContext(context)
  return (bbox: [number, number, number, number], zoom: number) =>
    territoryApi.getGreenAreasViewport({ bbox, zoom, ...scope })
}

function startViewportMode(
  context: GreenContext,
  loadGreenLayerViewport: ViewportFetcher,
  includeAreas: boolean
): void {
  const scope = scopeFromContext(context)
  const greenAreaId = context.greenAreaId
  const assetsFetcher = (bbox: [number, number, number, number], zoom: number) =>
    territoryApi.getGreenAssetsViewport({ bbox, zoom, greenAreaId, ...scope })
  loadGreenLayerViewport(assetsFetcher, includeAreas ? areasFetcherFor(context) : undefined)
}

/** Assets off + areas on: keep area polygons via empty assets + areas companion. */
function startAreasOnlyViewportMode(
  context: GreenContext,
  loadGreenLayerViewport: ViewportFetcher
): void {
  const emptyAssets = async () => EMPTY_FEATURE_COLLECTION
  loadGreenLayerViewport(emptyAssets, areasFetcherFor(context))
}

export function useGreenAssetsLayer(options: UseGreenAssetsLayerOptions): UseGreenAssetsLayerResult {
  const {
    breadcrumb,
    level,
    loadGreenLayerViewport,
    setGreenLayerVisible,
    clearGreenLayer,
    fitToGreenExtent,
    setTerritoryFillVisible,
    onBeforeLoadingAssets,
    assetsLayerActive,
    onAssetsLayerActiveChange,
    areasLayerActive,
    onAreasLayerActiveChange,
  } = options

  const [loading, setLoading] = useState(false)
  const lastContextKeyRef = useRef<string | null>(null)
  const areasLayerActiveRef = useRef(areasLayerActive)
  areasLayerActiveRef.current = areasLayerActive

  const context = useMemo(() => getGreenContext(breadcrumb), [breadcrumb])
  const contextKey = useMemo(() => greenContextKey(context), [context])
  const greenLevel = isGreenMapLevel(level)

  const turnOffAssetsLayer = useCallback(async () => {
    lastContextKeyRef.current = null
    onAssetsLayerActiveChange(false)
    if (areasLayerActiveRef.current) {
      // Keep areas visible: switch to areas-only viewport (same zoom gate).
      setLoading(true)
      startAreasOnlyViewportMode(context, loadGreenLayerViewport)
      setGreenLayerVisible(true)
      lastContextKeyRef.current = contextKey
      setLoading(false)
      return
    }
    setGreenLayerVisible(false)
    clearGreenLayer()
  }, [
    context,
    contextKey,
    loadGreenLayerViewport,
    setGreenLayerVisible,
    clearGreenLayer,
    onAssetsLayerActiveChange,
  ])

  const loadAssetsForContext = useCallback(async () => {
    if (greenLevel) {
      // Hide the gray fill only at green levels; at administrative levels the
      // territory polygons must stay visible (and clickable) under the clusters.
      setTerritoryFillVisible(false)
      onBeforeLoadingAssets?.()
    }
    setLoading(true)
    lastContextKeyRef.current = contextKey
    startViewportMode(context, loadGreenLayerViewport, areasLayerActiveRef.current)
    setGreenLayerVisible(true)
    onAssetsLayerActiveChange(true)
    setLoading(false)
    return true
  }, [
    context,
    contextKey,
    greenLevel,
    loadGreenLayerViewport,
    setGreenLayerVisible,
    setTerritoryFillVisible,
    onAssetsLayerActiveChange,
    onBeforeLoadingAssets,
  ])

  // Follow breadcrumb while assets viewport is active.
  useEffect(() => {
    if (!assetsLayerActive) return
    if (contextKey === lastContextKeyRef.current) return

    lastContextKeyRef.current = contextKey
    if (greenLevel) {
      setTerritoryFillVisible(false)
      onBeforeLoadingAssets?.()
    }
    setLoading(true)
    startViewportMode(context, loadGreenLayerViewport, areasLayerActiveRef.current)
    setGreenLayerVisible(true)
    if (greenLevel) fitToGreenExtent()
    setLoading(false)
  }, [
    assetsLayerActive,
    contextKey,
    context,
    greenLevel,
    loadGreenLayerViewport,
    setGreenLayerVisible,
    setTerritoryFillVisible,
    fitToGreenExtent,
    onBeforeLoadingAssets,
  ])

  // Follow breadcrumb while areas-only viewport is active (assets off).
  useEffect(() => {
    if (assetsLayerActive || !areasLayerActive) return
    if (contextKey === lastContextKeyRef.current) return

    lastContextKeyRef.current = contextKey
    setLoading(true)
    startAreasOnlyViewportMode(context, loadGreenLayerViewport)
    setGreenLayerVisible(true)
    setLoading(false)
  }, [
    assetsLayerActive,
    areasLayerActive,
    contextKey,
    context,
    loadGreenLayerViewport,
    setGreenLayerVisible,
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

      if (assetsLayerActive) {
        // Re-arm assets viewport: include/exclude companion areas.
        setLoading(true)
        startViewportMode(context, loadGreenLayerViewport, active)
        setGreenLayerVisible(true)
        lastContextKeyRef.current = contextKey
        setLoading(false)
        return
      }

      // Assets off: areas-only viewport or clear.
      if (active) {
        setLoading(true)
        startAreasOnlyViewportMode(context, loadGreenLayerViewport)
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
      loadGreenLayerViewport,
      setGreenLayerVisible,
      clearGreenLayer,
    ]
  )

  return { loading, available: true, setAssetsActive, setAreasActive }
}
