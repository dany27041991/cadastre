/**
 * Shared utilities for territory map: extent, style, canvas patch, feature labels.
 */
import OlMap from 'ol/Map'
import Style from 'ol/style/Style'
import Fill from 'ol/style/Fill'
import Stroke from 'ol/style/Stroke'
import { buffer, getWidth } from 'ol/extent'

export const VIEW_MAX_ZOOM = 17
export const CLUSTER_FIT_MAX_ZOOM = 20

/** 1) Administrative boundaries only: regions, provinces, municipalities, sub-municipal areas — gray. */
export const TERRITORY_STROKE_COLOR = '#4b5563'
export const TERRITORY_STROKE_WIDTH = 1.5
/** Select interaction highlight stroke (wider than layer). */
export const TERRITORY_STROKE_WIDTH_SELECT = 3
export const TERRITORY_FILL_OPACITY_LAYER = 0.25
export const TERRITORY_FILL_OPACITY_SELECT = 0.35

const TERRITORY_FILL_TRANSPARENT = 'rgba(0, 0, 0, 0)'

export function isValidExtent(extent: number[] | null): extent is number[] {
  return extent != null && extent.length > 0 && extent.every((v) => Number.isFinite(v))
}

export function zoomToExtent(map: OlMap, extent: number[]): void {
  if (isValidExtent(extent)) {
    const buffered = buffer(extent, getWidth(extent) * 0.05)
    map.getView().fit(buffered, { duration: 400, maxZoom: VIEW_MAX_ZOOM })
  }
}

export function createTerritoryStyleFn(
  getTransparent: () => boolean,
  strokeWidth: number,
  fillOpacity: number
): () => Style {
  return () =>
    new Style({
      fill: new Fill({
        color: getTransparent()
          ? TERRITORY_FILL_TRANSPARENT
          : `rgba(107, 114, 128, ${fillOpacity})`,
      }),
      stroke: new Stroke({ color: TERRITORY_STROKE_COLOR, width: strokeWidth }),
    })
}

export function patchCanvasGetContextForPerformance(): () => void {
  const original = HTMLCanvasElement.prototype.getContext
  ;(HTMLCanvasElement.prototype as { getContext: (contextId: string, options?: unknown) => RenderingContext | null }).getContext = function (contextId: string, options?: unknown) {
    if (contextId === '2d') {
      const opts =
        options && typeof options === 'object'
          ? { ...(options as Record<string, unknown>), willReadFrequently: true }
          : { willReadFrequently: true }
      return original.call(this, contextId, opts)
    }
    return original.call(this, contextId, options)
  }
  return () => {
    ;(HTMLCanvasElement.prototype as { getContext: typeof original }).getContext = original
  }
}

const LABEL_KEYS = ['name', 'code', 'istat_code', 'vehicle_registration_code', 'asset_type', 'species'] as const

/** Fallback label when no property matches (e.g. feature without name). */
export const DEFAULT_LABEL_SELECTED = 'Selected'

export function getFeatureLabel(props: Record<string, unknown>, id: unknown): string {
  for (const key of LABEL_KEYS) {
    const v = props[key]
    if (v != null && (typeof v === 'string' || typeof v === 'number')) {
      const s = String(v).trim()
      if (s !== '') return s
    }
  }
  return typeof id === 'number' ? `#${id}` : DEFAULT_LABEL_SELECTED
}

/** Extracts numeric id from an OL feature (properties, ol_uid, or getId). */
export function getFeatureId(feature: {
  getProperties(): Record<string, unknown>
  getId?(): number | string | undefined
}): number {
  const props = feature.getProperties()
  const raw = props.id ?? props.ol_uid ?? feature.getId?.()
  return typeof raw === 'number' ? raw : Number(raw)
}
