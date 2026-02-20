/**
 * Territory map hook: OpenLayers setup, GeoJSON, Select interaction.
 * Green layer: clustering to avoid freezes with thousands of points; single circles at zoom.
 */
import { useEffect, useRef, useCallback, useMemo } from 'react'
import OlMap from 'ol/Map'
import View from 'ol/View'
import TileLayer from 'ol/layer/Tile'
import OSM from 'ol/source/OSM'
import VectorLayer from 'ol/layer/Vector'
import VectorSource from 'ol/source/Vector'
import Cluster from 'ol/source/Cluster'
import GeoJSON from 'ol/format/GeoJSON'
import { Select } from 'ol/interaction'
import Style from 'ol/style/Style'
import Fill from 'ol/style/Fill'
import Stroke from 'ol/style/Stroke'
import Circle from 'ol/style/Circle'
import Text from 'ol/style/Text'
import { fromLonLat } from 'ol/proj'
import { buffer, extend, getCenter, getWidth } from 'ol/extent'
import Point from 'ol/geom/Point'
import type Feature from 'ol/Feature'
import type { GeoJSONFeatureCollection } from '@/shared/types/geojson'
import { ITALY_CENTER, ITALY_ZOOM } from '@/shared/constants/map'
import type { FeatureSelectHandler, UseTerritoryMapResult } from '@/shared/types/map'
import {
  greenClusterConfig,
  GREEN_CLUSTER_MAX_ZOOM_THRESHOLD,
  GREEN_CLUSTER_ZOOM_THROTTLE_MS,
  GREEN_CLUSTER_IDLE_TIMEOUT_MS,
  GREEN_CLUSTER_DISTANCE_AT_10,
  GREEN_CORE_RADIUS,
} from '@/shared/config/greenAssetCluster'

/** View max zoom (cannot zoom out below Italy level). */
const VIEW_MAX_ZOOM = 17
/** Max zoom when fitting a cluster (expand fully). */
const CLUSTER_FIT_MAX_ZOOM = 20

function zoomToExtent(map: OlMap, extent: number[]): void {
  if (extent.every((v) => isFinite(v))) {
    const buffered = buffer(extent, getWidth(extent) * 0.05)
    map.getView().fit(buffered, { duration: 400, maxZoom: VIEW_MAX_ZOOM })
  }
}

/** Keys used by backend GeoJSON (regions, provinces, municipalities, districts, green_areas, green_assets). */
const LABEL_KEYS = ['name', 'code', 'istat_code', 'vehicle_registration_code', 'asset_type', 'species'] as const
function getFeatureLabel(props: Record<string, unknown>, id: unknown): string {
  for (const key of LABEL_KEYS) {
    const v = props[key]
    if (v != null && (typeof v === 'string' || typeof v === 'number')) {
      const s = String(v).trim()
      if (s !== '') return s
    }
  }
  return typeof id === 'number' ? `#${id}` : 'Selected'
}

export type {
  FeatureSelectHandler,
  UseTerritoryMapResult,
  TerritoryMapCoreApi,
  TerritoryMapGreenApi,
} from '@/shared/types/map'

export function useTerritoryMap(): UseTerritoryMapResult {
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<OlMap | null>(null)
  const vectorSourceRef = useRef(new VectorSource())
  const vectorLayerRef = useRef<VectorLayer<VectorSource> | null>(null)
  const greenSourceRef = useRef(new VectorSource())
  const greenLayerRef = useRef<VectorLayer<VectorSource> | null>(null)
  const greenVisibleRef = useRef(false)
  const selectInteractionRef = useRef<InstanceType<typeof Select> | null>(null)
  const onFeatureSelectRef = useRef<FeatureSelectHandler>(() => {})

  const geoJsonFormat = useMemo(
    () =>
      new GeoJSON({
        dataProjection: 'EPSG:4326',
        featureProjection: 'EPSG:3857',
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
    const map = mapInstanceRef.current
    if (map) {
      map.getView().setCenter(fromLonLat(ITALY_CENTER))
      map.getView().setZoom(ITALY_ZOOM)
    }
  }, [])

  const fitToCurrentExtent = useCallback(() => {
    const map = mapInstanceRef.current
    const extent = vectorSourceRef.current.getExtent()
    if (map && extent.every((v) => isFinite(v))) zoomToExtent(map, extent)
  }, [])

  const showOnlyFeature = useCallback((feature: Feature) => {
    const geom = feature.getGeometry()
    if (!geom) return
    vectorSourceRef.current.clear()
    vectorSourceRef.current.addFeature(feature.clone())
    const map = mapInstanceRef.current
    if (map) zoomToExtent(map, geom.getExtent())
  }, [])

  const setOnFeatureSelect = useCallback((handler: FeatureSelectHandler) => {
    onFeatureSelectRef.current = handler
  }, [])

  const loadGreenLayer = useCallback(
    (geojson: GeoJSONFeatureCollection) => {
      const features = geoJsonFormat.readFeatures(geojson)
      greenSourceRef.current.clear()
      greenSourceRef.current.addFeatures(features)
    },
    [geoJsonFormat]
  )

  const setGreenLayerVisible = useCallback((visible: boolean) => {
    greenVisibleRef.current = visible
    const layer = greenLayerRef.current
    if (layer) layer.setVisible(visible)
    vectorLayerRef.current?.changed()
    if (visible) {
      selectInteractionRef.current?.getFeatures().clear()
    }
  }, [])

  const clearGreenLayer = useCallback(() => {
    greenSourceRef.current.clear()
    greenVisibleRef.current = false
    greenLayerRef.current?.setVisible(false)
    vectorLayerRef.current?.changed()
  }, [])

  const fitToGreenExtent = useCallback(() => {
    const map = mapInstanceRef.current
    const extent = greenSourceRef.current.getExtent()
    if (map && extent.every((v) => Number.isFinite(v))) zoomToExtent(map, extent)
  }, [])

  const setTerritoryFillVisible = useCallback((visible: boolean) => {
    greenVisibleRef.current = !visible
    vectorLayerRef.current?.changed()
  }, [])

  useEffect(() => {
    const div = mapRef.current
    if (!div) return

    const vectorSource = vectorSourceRef.current
    const strokeColor = '#1a5f2a'
    const strokeWidth = 2.5
    const territoryStyleFn = () =>
      greenVisibleRef.current
        ? new Style({
            fill: new Fill({ color: 'rgba(0, 0, 0, 0)' }),
            stroke: new Stroke({ color: strokeColor, width: strokeWidth }),
          })
        : new Style({
            fill: new Fill({ color: 'rgba(26, 95, 42, 0.3)' }),
            stroke: new Stroke({ color: strokeColor, width: strokeWidth }),
          })
    const vectorLayer = new VectorLayer({
      source: vectorSource,
      style: territoryStyleFn,
    })
    vectorLayerRef.current = vectorLayer

    const greenCoreCircle = new Circle({
      radius: GREEN_CORE_RADIUS,
      fill: new Fill({ color: 'rgba(72, 200, 72, 0.95)' }),
      stroke: new Stroke({ color: 'rgba(26, 95, 42, 0.9)', width: 1 }),
    })
    const greenClusterSource = new Cluster({
      source: greenSourceRef.current,
      distance: GREEN_CLUSTER_DISTANCE_AT_10,
      geometryFunction: (feature) => {
        const geom = feature.getGeometry()
        if (!geom) return null
        if (geom.getType() === 'Point') return geom as Point
        return new Point(getCenter(geom.getExtent()))
      },
    })
    const greenStyleFn = (feature: Feature): Style | Style[] => {
      const geom = feature.getGeometry()
      if (!geom) return []
      const point =
        geom.getType() === 'Point'
          ? (geom as Point)
          : new Point(getCenter(geom.getExtent()))
      const clusterFeatures = feature.get('features') as Feature[] | undefined
      const count = clusterFeatures?.length ?? 0
      if (count > 1) {
        const radius = Math.min(12 + Math.log(count) * 4, 26)
        return new Style({
          image: new Circle({
            radius,
            fill: new Fill({ color: 'rgba(34, 139, 34, 0.6)' }),
            stroke: new Stroke({ color: 'rgba(26, 95, 42, 0.9)', width: 1.5 }),
          }),
          geometry: point,
          text: new Text({
            text: count > 999 ? `${(count / 1000).toFixed(1)}k` : String(count),
            fill: new Fill({ color: '#fff' }),
            font: 'bold 11px sans-serif',
          }),
        })
      }
      return new Style({ image: greenCoreCircle, geometry: point })
    }
    const greenLayer = new VectorLayer({
      source: greenClusterSource,
      style: greenStyleFn,
      visible: false,
    })
    greenLayerRef.current = greenLayer

    const view = new View({
      center: fromLonLat(ITALY_CENTER),
      zoom: ITALY_ZOOM,
      minZoom: ITALY_ZOOM,
      maxZoom: CLUSTER_FIT_MAX_ZOOM,
    })

    const originalGetContext = HTMLCanvasElement.prototype.getContext
    ;(HTMLCanvasElement.prototype as { getContext: (contextId: string, options?: unknown) => RenderingContext | null }).getContext = function (contextId: string, options?: unknown) {
      if (contextId === '2d') {
        const opts =
          options && typeof options === 'object'
            ? { ...(options as Record<string, unknown>), willReadFrequently: true }
            : { willReadFrequently: true }
        return originalGetContext.call(this, contextId, opts)
      }
      return originalGetContext.call(this, contextId, options)
    }
    const map = new OlMap({
      target: div,
      layers: [
        new TileLayer({ source: new OSM() }),
        vectorLayer,
        greenLayer,
      ],
      view,
    })

    const getClusterDistanceForZoom = greenClusterConfig.getDistanceForZoom
    let clusterDistanceThrottle: ReturnType<typeof setTimeout> | null = null
    let clusterDistanceIdleId: number | undefined
    let clusterDistanceScheduledAsIdle = false
    const runClusterDistanceUpdate = () => {
      const zoom = view.getZoom() ?? 0
      const z = Math.floor(zoom)
      if (z >= GREEN_CLUSTER_MAX_ZOOM_THRESHOLD) {
        greenLayer.setSource(greenSourceRef.current)
        return
      }
      greenLayer.setSource(greenClusterSource)
      greenClusterSource.setDistance(getClusterDistanceForZoom(zoom))
    }
    const cancelClusterDistanceScheduled = () => {
      if (clusterDistanceIdleId == null) return
      if (clusterDistanceScheduledAsIdle && typeof cancelIdleCallback !== 'undefined') {
        cancelIdleCallback(clusterDistanceIdleId)
      } else {
        clearTimeout(clusterDistanceIdleId)
      }
      clusterDistanceIdleId = undefined
    }
    const scheduleClusterDistanceIdle = () => {
      cancelClusterDistanceScheduled()
      const run = () => {
        clusterDistanceIdleId = undefined
        runClusterDistanceUpdate()
      }
      if (typeof requestIdleCallback !== 'undefined') {
        clusterDistanceScheduledAsIdle = true
        clusterDistanceIdleId = requestIdleCallback(run, { timeout: GREEN_CLUSTER_IDLE_TIMEOUT_MS })
      } else {
        clusterDistanceScheduledAsIdle = false
        clusterDistanceIdleId = window.setTimeout(run, 0)
      }
    }
    const updateClusterDistance = () => {
      if (viewMoving) return
      const zoom = view.getZoom() ?? 0
      if (Math.floor(zoom) >= GREEN_CLUSTER_MAX_ZOOM_THRESHOLD) {
        runClusterDistanceUpdate()
        return
      }
      if (clusterDistanceThrottle != null) return
      clusterDistanceThrottle = setTimeout(() => {
        clusterDistanceThrottle = null
        if (viewMoving) return
        scheduleClusterDistanceIdle()
      }, GREEN_CLUSTER_ZOOM_THROTTLE_MS)
    }
    const updateClusterDistanceNow = () => {
      if (clusterDistanceThrottle != null) {
        clearTimeout(clusterDistanceThrottle)
        clusterDistanceThrottle = null
      }
      cancelClusterDistanceScheduled()
      runClusterDistanceUpdate()
    }
    view.on('change:resolution', updateClusterDistance)
    updateClusterDistanceNow()

    const selectStyleFn = (): Style =>
      greenVisibleRef.current
        ? new Style({
            stroke: new Stroke({ color: '#1a5f2a', width: 3 }),
            fill: new Fill({ color: 'rgba(0, 0, 0, 0)' }),
          })
        : new Style({
            fill: new Fill({ color: 'rgba(26, 95, 42, 0.5)' }),
            stroke: new Stroke({ color: '#1a5f2a', width: 3 }),
          })
    const select = new Select({ style: selectStyleFn })
    selectInteractionRef.current = select

    let lastPixel: number[] = [0, 0]
    let pointerThrottle: ReturnType<typeof setTimeout> | null = null
    let viewMoving = false
    let viewMovingEndTimeout: ReturnType<typeof setTimeout> | null = null
    const onMoveStart = () => {
      viewMoving = true
      if (viewMovingEndTimeout != null) clearTimeout(viewMovingEndTimeout)
      if (clusterDistanceThrottle != null) {
        clearTimeout(clusterDistanceThrottle)
        clusterDistanceThrottle = null
      }
      cancelClusterDistanceScheduled()
      const el = map.getTargetElement() as HTMLElement | null
      if (el) el.style.cursor = ''
      if (greenLayer.getVisible()) greenLayer.setVisible(false)
    }
    const onMoveEnd = () => {
      if (viewMovingEndTimeout != null) clearTimeout(viewMovingEndTimeout)
      viewMovingEndTimeout = setTimeout(() => {
        viewMovingEndTimeout = null
        viewMoving = false
        runClusterDistanceUpdate()
        greenLayer.setVisible(greenVisibleRef.current)
      }, 220)
    }
    const pointerHandler = (e: { pixel: number[] }) => {
      lastPixel = e.pixel
      const el = map.getTargetElement() as HTMLElement | null
      if (viewMoving) {
        if (el) el.style.cursor = ''
        return
      }
      if (pointerThrottle != null) return
      pointerThrottle = setTimeout(() => {
        pointerThrottle = null
        if (viewMoving) {
          if (el) el.style.cursor = ''
          return
        }
        const hit = map.hasFeatureAtPixel(lastPixel)
        if (el) el.style.cursor = hit ? 'pointer' : ''
      }, 60)
    }
    map.on('movestart', onMoveStart)
    map.on('moveend', onMoveEnd)
    map.on('pointermove', pointerHandler)

    const fitClusterExtent = (features: Feature[]) => {
      const first = features[0].getGeometry()?.getExtent()
      if (!first) return
      const extent = first.slice()
      for (let i = 1; i < features.length; i++) {
        const g = features[i].getGeometry()
        if (g) extend(extent, g.getExtent())
      }
      if (extent.every((v) => Number.isFinite(v))) {
        const padded = buffer(extent, getWidth(extent) * 0.1)
        map.getView().fit(padded, { duration: 300, maxZoom: CLUSTER_FIT_MAX_ZOOM })
      }
    }

    select.on('select', (e) => {
      const feature = e.selected[0]
      if (!feature) return
      const clusterFeatures = feature.get('features') as Feature[] | undefined
      const zoomLevel = Math.floor(view.getZoom() ?? 0)
      const isGreenAssetAtDetail =
        zoomLevel >= GREEN_CLUSTER_MAX_ZOOM_THRESHOLD &&
        greenSourceRef.current.getFeatures().includes(feature)

      if (isGreenAssetAtDetail) {
        select.getFeatures().clear()
        const el = map.getTargetElement() as HTMLElement | null
        if (el) el.style.cursor = ''
        const props = feature.getProperties()
        const id = (props.id ?? props.ol_uid) as number
        onFeatureSelectRef.current(id, getFeatureLabel(props, id), feature)
        return
      }

      if (clusterFeatures != null && clusterFeatures.length > 1) {
        fitClusterExtent(clusterFeatures)
        const firstId = (clusterFeatures[0].get('id') ?? clusterFeatures[0].getId()) as number
        onFeatureSelectRef.current(firstId, `Cluster (${clusterFeatures.length})`, clusterFeatures[0])
        return
      }

      const props = feature.getProperties()
      const id = (props.id ?? props.ol_uid) as number
      zoomToExtent(map, feature.getGeometry()!.getExtent())
      onFeatureSelectRef.current(id, getFeatureLabel(props, id), clusterFeatures?.[0] ?? feature)
    })

    map.addInteraction(select)
    mapInstanceRef.current = map

    return () => {
      ;(HTMLCanvasElement.prototype as { getContext: typeof originalGetContext }).getContext = originalGetContext
      view.un('change:resolution', updateClusterDistance)
      if (clusterDistanceThrottle != null) clearTimeout(clusterDistanceThrottle)
      cancelClusterDistanceScheduled()
      if (viewMovingEndTimeout != null) clearTimeout(viewMovingEndTimeout)
      map.un('movestart', onMoveStart)
      map.un('moveend', onMoveEnd)
      if (pointerThrottle != null) clearTimeout(pointerThrottle)
      map.un('pointermove', pointerHandler)
      map.removeInteraction(select)
      selectInteractionRef.current = null
      map.setTarget(undefined)
      mapInstanceRef.current = null
      vectorLayerRef.current = null
      greenLayerRef.current = null
    }
  }, [])

  return {
    mapRef,
    loadGeoJson,
    fitToCurrentExtent,
    centerOnItaly,
    showOnlyFeature,
    setOnFeatureSelect,
    loadGreenLayer,
    setGreenLayerVisible,
    clearGreenLayer,
    fitToGreenExtent,
    setTerritoryFillVisible,
  }
}
