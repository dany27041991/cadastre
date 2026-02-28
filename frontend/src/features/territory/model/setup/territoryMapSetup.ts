/**
 * Territory map one-time setup: layers (territory + green), select, pointer.
 */
import OlMap from 'ol/Map'
import View from 'ol/View'
import TileLayer from 'ol/layer/Tile'
import OSM from 'ol/source/OSM'
import VectorLayer from 'ol/layer/Vector'
import VectorSource from 'ol/source/Vector'
import { Select } from 'ol/interaction'
import { fromLonLat } from 'ol/proj'
import type Feature from 'ol/Feature'
import type OlPoint from 'ol/geom/Point'
import { ITALY_CENTER, ITALY_ZOOM } from '@/shared/config/map'
import type { FeatureSelectHandler } from '../../types'
import {
  CLUSTER_FIT_MAX_ZOOM,
  createTerritoryStyleFn,
  patchCanvasGetContextForPerformance,
  isValidExtent,
  zoomToExtent,
  getFeatureLabel,
  getFeatureId,
  TERRITORY_STROKE_WIDTH,
  TERRITORY_STROKE_WIDTH_SELECT,
  TERRITORY_FILL_OPACITY_LAYER,
  TERRITORY_FILL_OPACITY_SELECT,
} from '../utils/territoryMapUtils'
import { greenClusterStyleFn } from './greenLayerStyle'
import { GREEN_CLUSTER_MAX_ZOOM_THRESHOLD } from '../../lib/greenAssetCluster'

const MOVE_END_DEBOUNCE_MS = 220
const POINTER_THROTTLE_MS = 60

export interface TerritoryMapSetupRefs {
  vectorSourceRef: { current: VectorSource }
  /** Cluster display source: holds ≤ N cluster/display features. Never holds all raw assets at zoom >= threshold. */
  greenSourceRef: { current: VectorSource }
  /** Raw asset source: pre-populated once at load; never cleared on zoom transitions. Enables 0-cost threshold crossings. */
  greenRawSourceRef: { current: VectorSource }
  /** Called on zoom/resolution change to re-apply precomputed clustering. */
  applyGreenClusteringRef: { current: () => void }
  greenVisibleRef: { current: boolean }
  /** When true, next moveend will show the green layer (so areas render only after zoom animation ends). */
  showGreenOnMoveEndRef: { current: boolean }
  onFeatureSelectRef: { current: FeatureSelectHandler }
  /** Shared moving flag: set true on movestart, false on moveend. Hook reads it to suppress clustering during animation. */
  viewMovingRef: { current: boolean }
  /** True when the raw asset layer is the active display (zoom >= threshold). Set by applyGreenClustering. */
  greenUsingRawLayerRef: { current: boolean }
  /** Optional: when provided, cluster selection label is translated. */
  getClusterLabel?: (count: number) => string
}

export interface TerritoryMapSetupResult {
  map: OlMap
  vectorLayer: VectorLayer<VectorSource>
  greenLayer: VectorLayer<VectorSource>
  greenRawLayer: VectorLayer<VectorSource>
  select: InstanceType<typeof Select>
  pointerHandler: (e: { pixel: number[] }) => void
  pointerCleanup: () => void
  clusterCleanup: () => void
  onMoveStart: () => void
  onMoveEnd: () => void
  restoreCanvas: () => void
}

export function createTerritoryMapSetup(
  containerDiv: HTMLDivElement,
  refs: TerritoryMapSetupRefs
): TerritoryMapSetupResult {
  const vectorLayer = new VectorLayer({
    source: refs.vectorSourceRef.current,
    style: createTerritoryStyleFn(
      () => refs.greenVisibleRef.current,
      TERRITORY_STROKE_WIDTH,
      TERRITORY_FILL_OPACITY_LAYER
    ),
  })

  // Shared style adapter: OL passes FeatureLike but greenClusterStyleFn expects Feature.
  const greenStyle = (f: object, _r: number) => greenClusterStyleFn(f as Feature)

  // Green cluster layer: holds ≤ N cluster display features; shown at zoom < threshold.
  const greenLayer = new VectorLayer({ source: refs.greenSourceRef.current, style: greenStyle, visible: false })

  // Green raw layer: pre-populated once at load with all raw assets; shown at zoom >= threshold. Visibility toggled, source never reloaded on zoom.
  const greenRawLayer = new VectorLayer({ source: refs.greenRawSourceRef.current, style: greenStyle, visible: false })

  const view = new View({
    center: fromLonLat(ITALY_CENTER),
    zoom: ITALY_ZOOM,
    minZoom: ITALY_ZOOM,
    maxZoom: CLUSTER_FIT_MAX_ZOOM,
  })

  const restoreCanvas = patchCanvasGetContextForPerformance()
  const map = new OlMap({
    target: containerDiv,
    layers: [
      new TileLayer({ source: new OSM() }),
      vectorLayer,
      greenLayer,
      greenRawLayer,
    ],
    view,
  })

  let resolutionRafId: number | null = null
  const onResolutionChange = () => {
    if (resolutionRafId != null) cancelAnimationFrame(resolutionRafId)
    resolutionRafId = requestAnimationFrame(() => {
      resolutionRafId = null
      refs.applyGreenClusteringRef.current?.()
    })
  }
  map.getView().on('change:resolution', onResolutionChange)

  const { cleanup: clusterCleanup, onMoveStart, onMoveEnd } = setupGreenLayerMoveBehavior(
    map,
    vectorLayer,
    greenLayer,
    greenRawLayer,
    refs
  )

  const clusterCleanupWithZoom = () => {
    map.getView().un('change:resolution', onResolutionChange)
    if (resolutionRafId != null) cancelAnimationFrame(resolutionRafId)
    clusterCleanup()
  }

  const territorySelectStyleFn = createTerritoryStyleFn(
    () => refs.greenVisibleRef.current,
    TERRITORY_STROKE_WIDTH_SELECT,
    TERRITORY_FILL_OPACITY_SELECT
  )
  const select = new Select({
    style: (feature: unknown) => {
      const f = feature as Feature
      // O(1) checks first: cluster feature or marked raw asset.
      // Fallback O(n) only for area features in skip-clustering mode (small sets, ≤ ~250).
      const isFromGreenLayer =
        f.get?.('features') != null ||
        f.get?.('_greenAsset') === true ||
        refs.greenSourceRef.current.getFeatures().includes(f)
      if (isFromGreenLayer) {
        const style = greenClusterStyleFn(f)
        return Array.isArray(style) ? style : [style]
      }
      return territorySelectStyleFn()
    },
  })

  const { handler: pointerHandler, cleanup: pointerCleanup } = setupPointerHandlers(
    map,
    refs.viewMovingRef
  )

  setupSelectHandler(map, select, refs)

  return {
    map,
    vectorLayer,
    greenLayer,
    greenRawLayer,
    select,
    pointerHandler,
    pointerCleanup,
    clusterCleanup: clusterCleanupWithZoom,
    onMoveStart,
    onMoveEnd,
    restoreCanvas,
  }
}

function setupGreenLayerMoveBehavior(
  map: OlMap,
  vectorLayer: VectorLayer<VectorSource>,
  greenLayer: VectorLayer<VectorSource>,
  greenRawLayer: VectorLayer<VectorSource>,
  refs: TerritoryMapSetupRefs
): { cleanup: () => void; onMoveStart: () => void; onMoveEnd: () => void } {
  let viewMovingEndTimeout: ReturnType<typeof setTimeout> | null = null

  const onMoveStart = () => {
    refs.viewMovingRef.current = true
    if (viewMovingEndTimeout != null) clearTimeout(viewMovingEndTimeout)
    const el = map.getTargetElement() as HTMLElement | null
    if (el) el.style.cursor = ''
    // Hide both green layers during animation; restored in onMoveEnd.
    if (greenLayer.getVisible()) greenLayer.setVisible(false)
    if (greenRawLayer.getVisible()) greenRawLayer.setVisible(false)
  }

  const onMoveEnd = () => {
    if (viewMovingEndTimeout != null) clearTimeout(viewMovingEndTimeout)
    viewMovingEndTimeout = setTimeout(() => {
      viewMovingEndTimeout = null
      refs.viewMovingRef.current = false
      // Update source content / mode flag for the final zoom level.
      refs.applyGreenClusteringRef.current?.()
      if (refs.showGreenOnMoveEndRef.current) {
        refs.showGreenOnMoveEndRef.current = false
        refs.greenVisibleRef.current = true
        vectorLayer.changed()
      }
      // Show the appropriate green layer based on mode flag set by applyGreenClustering.
      if (refs.greenVisibleRef.current) {
        const useRaw = refs.greenUsingRawLayerRef.current
        greenLayer.setVisible(!useRaw)
        greenRawLayer.setVisible(useRaw)
      }
    }, MOVE_END_DEBOUNCE_MS)
  }

  const cleanup = () => {
    if (viewMovingEndTimeout != null) clearTimeout(viewMovingEndTimeout)
  }
  return { cleanup, onMoveStart, onMoveEnd }
}

function setupPointerHandlers(
  map: OlMap,
  viewMovingRef: { current: boolean }
): { handler: (e: { pixel: number[] }) => void; cleanup: () => void } {
  let lastPixel: number[] = [0, 0]
  let pointerThrottle: ReturnType<typeof setTimeout> | null = null
  const handler = (e: { pixel: number[] }) => {
    lastPixel = e.pixel
    const el = map.getTargetElement() as HTMLElement | null
    if (viewMovingRef.current) {
      if (el) el.style.cursor = ''
      return
    }
    if (pointerThrottle != null) return
    pointerThrottle = setTimeout(() => {
      pointerThrottle = null
      if (viewMovingRef.current) {
        if (el) el.style.cursor = ''
        return
      }
      const hit = map.hasFeatureAtPixel(lastPixel)
      if (el) el.style.cursor = hit ? 'pointer' : ''
    }, POINTER_THROTTLE_MS)
  }
  const cleanup = () => {
    if (pointerThrottle != null) clearTimeout(pointerThrottle)
  }
  return { handler, cleanup }
}

function zoomToCluster(map: OlMap, feature: Feature): void {
  const geom = feature.getGeometry()
  if (!geom) return
  const center = geom.getType() === 'Point'
    ? (geom as OlPoint).getCoordinates()
    : undefined
  map.getView().animate({ zoom: GREEN_CLUSTER_MAX_ZOOM_THRESHOLD, center, duration: 400 })
}

function setupSelectHandler(
  map: OlMap,
  select: InstanceType<typeof Select>,
  refs: TerritoryMapSetupRefs
): void {
  const notifySelected = (feature: Feature, label?: string) => {
    const id = getFeatureId(feature)
    const resolvedLabel = label ?? getFeatureLabel(feature.getProperties(), id)
    refs.onFeatureSelectRef.current(id, resolvedLabel, feature)
  }

  select.on('select', (e) => {
    const feature = e.selected[0]
    if (!feature) return
    const clusterFeatures = feature.get('features') as Feature[] | undefined
    const isFromGreenLayer =
      clusterFeatures != null ||
      feature.get('_greenAsset') === true ||
      refs.greenSourceRef.current.getFeatures().includes(feature)

    if (!isFromGreenLayer) {
      const geom = feature.getGeometry()
      if (geom && isValidExtent(geom.getExtent())) zoomToExtent(map, geom.getExtent())
      notifySelected(feature)
      return
    }

    select.getFeatures().clear()
    const el = map.getTargetElement() as HTMLElement | null
    if (el) el.style.cursor = ''
    if (clusterFeatures != null && clusterFeatures.length > 1) {
      zoomToCluster(map, feature)
      return
    }
    notifySelected(clusterFeatures?.[0] ?? feature)
  })
}
