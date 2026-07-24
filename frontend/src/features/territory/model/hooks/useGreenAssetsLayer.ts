/**
 * Green assets map layer (trees, rows, lawns): toggle + fetch logic.
 * Available at every administrative level: with an empty breadcrumb the
 * clusters cover the whole national territory; each breadcrumb selection
 * narrows the scope (region, province, municipality, sub-municipal area).
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
}

export interface UseGreenAssetsLayerResult {
  readonly loading: boolean
  readonly available: boolean
  readonly setActive: (active: boolean) => void
}

function startViewportMode(
  context: GreenContext,
  loadGreenLayerViewport: UseGreenAssetsLayerOptions['loadGreenLayerViewport']
): void {
  const scope = {
    regionId: context.regionId,
    provinceId: context.provinceId,
    municipalityId: context.municipalityId,
    subMunicipalAreaId: context.subMunicipalAreaId,
  }
  const greenAreaId = context.greenAreaId
  loadGreenLayerViewport(
    (bbox, zoom) =>
      territoryApi.getGreenAssetsViewport({ bbox, zoom, greenAreaId, ...scope }),
    (bbox, zoom) => territoryApi.getGreenAreasViewport({ bbox, zoom, ...scope })
  )
}

export function useGreenAssetsLayer(options: UseGreenAssetsLayerOptions): UseGreenAssetsLayerResult {
  const {
    breadcrumb,
    level,
    loadGreenLayerViewport,
    setGreenLayerVisible,
    clearGreenLayer,
    restoreGreenAreas,
    fitToGreenExtent,
    setTerritoryFillVisible,
    onBeforeLoadingAssets,
    assetsLayerActive,
    onAssetsLayerActiveChange,
  } = options

  const [loading, setLoading] = useState(false)
  const lastContextKeyRef = useRef<string | null>(null)

  const context = useMemo(() => getGreenContext(breadcrumb), [breadcrumb])
  const contextKey = useMemo(() => greenContextKey(context), [context])
  const greenLevel = isGreenMapLevel(level)

  const turnOffGreenLayer = useCallback(
    async (options?: { skipFit?: boolean }) => {
      lastContextKeyRef.current = null
      onAssetsLayerActiveChange(false)
      if (greenLevel && restoreGreenAreas) {
        await restoreGreenAreas(options)
        return
      }
      // At administrative levels the territory polygons are still mounted:
      // dropping the green layer is enough.
      setGreenLayerVisible(false)
      clearGreenLayer()
    },
    [greenLevel, setGreenLayerVisible, clearGreenLayer, restoreGreenAreas, onAssetsLayerActiveChange]
  )

  const loadAssetsForContext = useCallback(async () => {
    if (greenLevel) {
      // Hide the gray fill only at green levels; at administrative levels the
      // territory polygons must stay visible (and clickable) under the clusters.
      setTerritoryFillVisible(false)
      onBeforeLoadingAssets?.()
    }
    setLoading(true)
    lastContextKeyRef.current = contextKey
    startViewportMode(context, loadGreenLayerViewport)
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

  // While the layer is active, follow the administrative selection: any
  // breadcrumb change (deeper or shallower) refetches with the new scope.
  useEffect(() => {
    if (!assetsLayerActive) return
    if (contextKey === lastContextKeyRef.current) return

    lastContextKeyRef.current = contextKey
    if (greenLevel) {
      setTerritoryFillVisible(false)
      onBeforeLoadingAssets?.()
    }
    setLoading(true)
    startViewportMode(context, loadGreenLayerViewport)
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

  const setActive = useCallback(
    async (active: boolean) => {
      if (loading) return
      if (active) {
        if (assetsLayerActive) return
        await loadAssetsForContext()
        return
      }
      if (!assetsLayerActive) return
      // Manual toggle keeps the user's zoom level: no fit-to-extent on restore.
      await turnOffGreenLayer({ skipFit: true })
    },
    [loading, assetsLayerActive, loadAssetsForContext, turnOffGreenLayer]
  )

  return { loading, available: true, setActive }
}
