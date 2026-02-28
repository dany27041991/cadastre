/**
 * Territory map hook: OpenLayers setup, GeoJSON, Select interaction.
 * Green layer: clustering for points at low zoom; zoom >= threshold shows all assets.
 */
import { useEffect, useRef, useCallback, useMemo } from 'react'
import OlMap from 'ol/Map'
import VectorLayer from 'ol/layer/Vector'
import VectorSource from 'ol/source/Vector'
import GeoJSON from 'ol/format/GeoJSON'
import { fromLonLat } from 'ol/proj'
import type Feature from 'ol/Feature'
import type { GeoJSONFeatureCollection } from '@/shared/types'
import {
  ITALY_CENTER,
  ITALY_ZOOM,
  GEOJSON_DATA_PROJECTION,
  GEOJSON_FEATURE_PROJECTION,
} from '@/shared/config/map'
import type { TFunction } from 'i18next'
import type { Select } from 'ol/interaction'
import type { FeatureSelectHandler, UseTerritoryMapResult } from '../../types'
import { getClusterLabel } from '../constants'
import { isValidExtent, zoomToExtent } from '../utils/territoryMapUtils'
import {
  buildClusteredDisplayFeatures,
  buildClusterCache,
  GREEN_CLUSTER_MAX_ZOOM_THRESHOLD,
  GREEN_CLUSTER_PRECOMPUTE_ZOOM_LEVELS,
} from '../../lib/greenAssetCluster'
import {
  createTerritoryMapSetup,
  type TerritoryMapSetupRefs,
} from '../setup/territoryMapSetup'

export type { FeatureSelectHandler, UseTerritoryMapResult } from '../../types'

/**
 * Resolves the cluster display feature array for zoom < GREEN_CLUSTER_MAX_ZOOM_THRESHOLD.
 * The raw-layer mode (zoom >= threshold) is handled separately in applyGreenClustering.
 * Returns null when the cluster source is already in the correct state (idempotent no-op).
 */
function resolveGreenDisplay(
  raw: Feature[],
  cache: Map<number, Feature[]> | null,
  zoom: number,
  getResolution: () => number | undefined,
  showingRawRef: { current: boolean },
  lastCacheZoomRef: { current: number | null }
): Feature[] | null {
  if (!cache) {
    const resolution = getResolution()
    if (resolution == null) return null
    showingRawRef.current = false
    lastCacheZoomRef.current = null
    return buildClusteredDisplayFeatures(raw, zoom, resolution)
  }
  // Cache available; zoom < threshold (raw mode handled before calling this).
  const minZ = GREEN_CLUSTER_PRECOMPUTE_ZOOM_LEVELS[0] ?? 10
  const maxZ = GREEN_CLUSTER_PRECOMPUTE_ZOOM_LEVELS[GREEN_CLUSTER_PRECOMPUTE_ZOOM_LEVELS.length - 1] ?? 13
  const level = Math.min(Math.max(minZ, Math.floor(zoom)), maxZ)
  if (lastCacheZoomRef.current === level) return null
  showingRawRef.current = false
  lastCacheZoomRef.current = level
  return cache.get(level) ?? raw
}

export interface UseTerritoryMapOptions {
  /** Optional i18n translate; when provided, cluster selection label is translated. */
  t?: TFunction
}

export function useTerritoryMap(options?: UseTerritoryMapOptions): UseTerritoryMapResult {
  const t = options?.t
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<OlMap | null>(null)
  const vectorSourceRef = useRef(new VectorSource())
  const vectorLayerRef = useRef<VectorLayer<VectorSource> | null>(null)
  /** Cluster display source: holds ≤ N cluster features; never stores all raw assets at zoom >= threshold. */
  const greenSourceRef = useRef(new VectorSource())
  /** Raw asset source: pre-populated once at load; visibility-toggled at threshold, never reloaded on zoom. */
  const greenRawSourceRef = useRef(new VectorSource())
  const greenRawFeaturesRef = useRef<Feature[]>([])
  const greenSkipClusteringRef = useRef(false)
  /** Precomputed display features per zoom level (built once at load to avoid recalc on zoom). */
  const greenClusterCacheRef = useRef<Map<number, Feature[]> | null>(null)
  /** Idempotency: true once the raw source has been shown for the current load (zoom >= threshold). */
  const greenShowingRawRef = useRef(false)
  /** Last integer zoom level used to pick a cache entry. Avoids re-applying the same cluster level. */
  const greenLastCacheZoomRef = useRef<number | null>(null)
  /** True when the source is already populated with the current skip-clustering features. Avoids re-adds during zoom. */
  const greenSkipLoadedRef = useRef(false)
  /** Mirrors the setup's moving flag; true between movestart and the post-moveend debounce. Suppresses clustering during animation. */
  const viewMovingRef = useRef(false)
  /** True when greenRawLayer is the active green display (zoom >= threshold). Read by setup to toggle visibility in onMoveEnd. */
  const greenUsingRawLayerRef = useRef(false)
  const applyGreenClusteringRef = useRef<() => void>(() => {})
  const greenLayerRef = useRef<VectorLayer<VectorSource> | null>(null)
  const greenRawLayerRef = useRef<VectorLayer<VectorSource> | null>(null)
  const greenVisibleRef = useRef(false)
  const showGreenOnMoveEndRef = useRef(false)
  const selectInteractionRef = useRef<Select | null>(null)
  const onFeatureSelectRef = useRef<FeatureSelectHandler>(() => {})

  const geoJsonFormat = useMemo(
    () =>
      new GeoJSON({
        dataProjection: GEOJSON_DATA_PROJECTION,
        featureProjection: GEOJSON_FEATURE_PROJECTION,
      }),
    []
  )

  const loadGeoJson = useCallback(
    (geojson: GeoJSONFeatureCollection) => {
      const features = geoJsonFormat.readFeatures(geojson)
      vectorSourceRef.current.clear()
      vectorSourceRef.current.addFeatures(features)
    },
    [geoJsonFormat]
  )

  const centerOnItaly = useCallback(() => {
    const view = mapInstanceRef.current?.getView()
    if (!view) return
    view.setCenter(fromLonLat(ITALY_CENTER))
    view.setZoom(ITALY_ZOOM)
  }, [])

  const fitToSourceExtent = useCallback(
    (source: VectorSource) => {
      const map = mapInstanceRef.current
      const extent = source.getExtent()
      if (map && isValidExtent(extent)) zoomToExtent(map, extent)
    },
    []
  )

  const fitToCurrentExtent = useCallback(
    () => fitToSourceExtent(vectorSourceRef.current),
    [fitToSourceExtent]
  )

  const showOnlyFeature = useCallback((feature: Feature) => {
    const geom = feature.getGeometry()
    if (!geom) return
    vectorSourceRef.current.clear()
    vectorSourceRef.current.addFeature(feature.clone())
    const map = mapInstanceRef.current
    const extent = geom.getExtent()
    if (map && isValidExtent(extent)) zoomToExtent(map, extent)
  }, [])

  const loadGeoJsonAndShowOnlyFeatureById = useCallback(
    (geojson: GeoJSONFeatureCollection, featureId: number) => {
      const features = geoJsonFormat.readFeatures(geojson)
      const match = features.find(
        (f) => f.getId() === featureId || (f.get('id') as number) === featureId
      )
      if (match) {
        showOnlyFeature(match)
        return
      }
      vectorSourceRef.current.clear()
      vectorSourceRef.current.addFeatures(features)
      fitToSourceExtent(vectorSourceRef.current)
    },
    [geoJsonFormat, showOnlyFeature, fitToSourceExtent]
  )

  const setOnFeatureSelect = useCallback((handler: FeatureSelectHandler) => {
    onFeatureSelectRef.current = handler
  }, [])

  const applyGreenClustering = useCallback(() => {
    if (greenSkipClusteringRef.current) {
      // Idempotency: skip-clustering source is already populated – zoom changes are irrelevant.
      if (greenSkipLoadedRef.current) return
      const raw = greenRawFeaturesRef.current
      greenSourceRef.current.clear(true)
      greenSourceRef.current.addFeatures(raw)
      greenSkipLoadedRef.current = true
      return
    }
    const map = mapInstanceRef.current
    if (!map) return
    const zoom = map.getView().getZoom()
    if (zoom == null) return
    const raw = greenRawFeaturesRef.current
    // No features loaded yet, or map is animating (layer hidden; deferred to onMoveEnd).
    if (raw.length === 0 || viewMovingRef.current) return

    const cache = greenClusterCacheRef.current

    // RAW LAYER MODE: raw asset source is pre-populated; just flag the mode so onMoveEnd shows the right layer.
    if (cache && zoom >= GREEN_CLUSTER_MAX_ZOOM_THRESHOLD) {
      if (greenUsingRawLayerRef.current) return // already in raw mode, no-op
      greenUsingRawLayerRef.current = true
      greenShowingRawRef.current = true
      greenLastCacheZoomRef.current = null
      return
    }

    // CLUSTER MODE: update cluster display source (fast: ≤ N cluster features).
    greenUsingRawLayerRef.current = false
    const display = resolveGreenDisplay(
      raw,
      cache,
      zoom,
      () => map.getView().getResolution(),
      greenShowingRawRef,
      greenLastCacheZoomRef
    )
    if (display == null) return
    // fast=true: skips per-feature removefeature events.
    greenSourceRef.current.clear(true)
    greenSourceRef.current.addFeatures(display)
  }, [])

  const buildGreenClusterCacheIfNeeded = useCallback(() => {
    const raw = greenRawFeaturesRef.current
    const map = mapInstanceRef.current
    if (greenSkipClusteringRef.current || raw.length === 0 || !map) return
    greenClusterCacheRef.current = buildClusterCache(raw, (z) => map.getView().getResolutionForZoom(z))
  }, [])

  const loadGreenLayer = useCallback(
    (geojson: GeoJSONFeatureCollection, options?: { skipClustering?: boolean }) => {
      if (
        !geojson ||
        (geojson as { type?: string }).type !== 'FeatureCollection'
      ) {
        greenRawFeaturesRef.current = []
        greenClusterCacheRef.current = null
        greenSkipClusteringRef.current = false
        greenSourceRef.current.clear()
        return
      }
      const features = geoJsonFormat.readFeatures(geojson)
      const skipClustering = Boolean(options?.skipClustering)
      greenRawFeaturesRef.current = features
      greenSkipClusteringRef.current = skipClustering
      greenShowingRawRef.current = false
      greenLastCacheZoomRef.current = null
      greenSkipLoadedRef.current = false
      greenUsingRawLayerRef.current = false
      if (skipClustering) {
        greenClusterCacheRef.current = null
        greenRawSourceRef.current.clear(true)
        greenSourceRef.current.clear()
        greenSourceRef.current.addFeatures(features)
        greenSkipLoadedRef.current = true
      } else {
        // Mark raw features for O(1) green detection in the select handler.
        for (const f of features) f.set('_greenAsset', true)
        // Pre-populate raw source once; this enables zero-cost threshold transitions via layer visibility toggle.
        greenRawSourceRef.current.clear(true)
        greenRawSourceRef.current.addFeatures(features)
        buildGreenClusterCacheIfNeeded()
        applyGreenClusteringRef.current()
      }
    },
    [geoJsonFormat, buildGreenClusterCacheIfNeeded]
  )

  const loadGreenLayerFromFeature = useCallback((feature: Feature) => {
    greenClusterCacheRef.current = null
    greenSkipClusteringRef.current = true
    greenShowingRawRef.current = false
    greenLastCacheZoomRef.current = null
    greenSkipLoadedRef.current = true
    greenUsingRawLayerRef.current = false
    greenRawSourceRef.current.clear(true)
    greenRawFeaturesRef.current = [feature.clone()]
    greenSourceRef.current.clear()
    greenSourceRef.current.addFeature(feature.clone())
  }, [])

  // Returns current green layer features (e.g. to save the single area before loading assets at leaf level).
  const getGreenLayerFeatures = useCallback((): Feature[] => greenSourceRef.current.getFeatures(), [])

  const setGreenLayerVisible = useCallback((visible: boolean) => {
    greenVisibleRef.current = visible
    // Show the active green layer based on zoom mode; both hidden when visible=false.
    const useRaw = visible && greenUsingRawLayerRef.current
    greenLayerRef.current?.setVisible(visible && !useRaw)
    greenRawLayerRef.current?.setVisible(useRaw)
    vectorLayerRef.current?.changed()
    if (visible) selectInteractionRef.current?.getFeatures().clear()
  }, [])

  const resetGreenState = useCallback(() => {
    greenClusterCacheRef.current = null
    greenSkipClusteringRef.current = false
    greenShowingRawRef.current = false
    greenLastCacheZoomRef.current = null
    greenSkipLoadedRef.current = false
    greenUsingRawLayerRef.current = false
    greenRawFeaturesRef.current = []
    greenRawSourceRef.current.clear(true)
    greenSourceRef.current.clear()
    greenVisibleRef.current = false
    showGreenOnMoveEndRef.current = false
    greenLayerRef.current?.setVisible(false)
    greenRawLayerRef.current?.setVisible(false)
  }, [])

  const clearGreenLayer = useCallback(() => {
    resetGreenState()
    selectInteractionRef.current?.getFeatures().clear()
    vectorLayerRef.current?.changed()
  }, [resetGreenState])

  // Clears the territory vector layer (rendered admin/area features).
  const clearTerritoryLayer = useCallback(() => {
    vectorSourceRef.current.clear()
    selectInteractionRef.current?.getFeatures().clear()
    vectorLayerRef.current?.changed()
  }, [])

  // Clears green + territory and forces map repaint (e.g. before navigating to admin level).
  const clearMapVectorLayers = useCallback(() => {
    resetGreenState()
    vectorSourceRef.current.clear()
    selectInteractionRef.current?.getFeatures().clear()
    vectorLayerRef.current?.changed()
    greenLayerRef.current?.changed()
    mapInstanceRef.current?.render()
  }, [resetGreenState])

  const fitToGreenExtent = useCallback(() => {
    // Prefer raw source: covers all assets. Fallback to cluster source for skip-clustering (areas) mode.
    fitToSourceExtent(
      greenRawSourceRef.current.getFeatures().length > 0
        ? greenRawSourceRef.current
        : greenSourceRef.current
    )
  }, [fitToSourceExtent])

  // Schedules showing the green layer when the next moveend fires (after zoom/fit animation).
  const setGreenLayerVisibleWhenMoveEnds = useCallback(() => {
    showGreenOnMoveEndRef.current = true
  }, [])

  const setTerritoryFillVisible = useCallback((visible: boolean) => {
    greenVisibleRef.current = !visible
    vectorLayerRef.current?.changed()
  }, [])

  useEffect(() => {
    const div = mapRef.current
    if (!div) return

    applyGreenClusteringRef.current = applyGreenClustering
    const refs: TerritoryMapSetupRefs = {
      vectorSourceRef,
      greenSourceRef,
      greenRawSourceRef,
      applyGreenClusteringRef,
      greenVisibleRef,
      showGreenOnMoveEndRef,
      onFeatureSelectRef,
      viewMovingRef,
      greenUsingRawLayerRef,
      getClusterLabel: t ? (count) => getClusterLabel(count, t) : undefined,
    }
    const setup = createTerritoryMapSetup(div, refs)

    vectorLayerRef.current = setup.vectorLayer
    greenLayerRef.current = setup.greenLayer
    greenRawLayerRef.current = setup.greenRawLayer
    selectInteractionRef.current = setup.select
    mapInstanceRef.current = setup.map

    setup.map.on('movestart', setup.onMoveStart)
    setup.map.on('moveend', setup.onMoveEnd)
    setup.map.on('pointermove', setup.pointerHandler)
    setup.map.addInteraction(setup.select)

    return () => {
      setup.restoreCanvas()
      setup.clusterCleanup()
      setup.pointerCleanup()
      setup.map.un('movestart', setup.onMoveStart)
      setup.map.un('moveend', setup.onMoveEnd)
      setup.map.un('pointermove', setup.pointerHandler)
      setup.map.removeInteraction(setup.select)
      selectInteractionRef.current = null
      setup.map.setTarget()
      mapInstanceRef.current = null
      vectorLayerRef.current = null
      greenLayerRef.current = null
      greenRawLayerRef.current = null
    }
  }, [])

  return {
    mapRef,
    loadGeoJson,
    loadGeoJsonAndShowOnlyFeatureById,
    fitToCurrentExtent,
    centerOnItaly,
    showOnlyFeature,
    setOnFeatureSelect,
    loadGreenLayer,
    loadGreenLayerFromFeature,
    getGreenLayerFeatures,
    setGreenLayerVisible,
    clearGreenLayer,
    clearTerritoryLayer,
    clearMapVectorLayers,
    fitToGreenExtent,
    setGreenLayerVisibleWhenMoveEnds,
    setTerritoryFillVisible,
  }
}
