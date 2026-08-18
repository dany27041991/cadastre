import Fill from 'ol/style/Fill'
import Stroke from 'ol/style/Stroke'
import Style from 'ol/style/Style'
import { geoinsightConfig } from '@/app/config/geoinsight'
import {
  LAYER_ATTR_ID,
  LAYER_ATTR_IDENTIFIER,
  MAP_TRIGGER,
  OUTLINE_FILL_TRANSPARENT,
  OUTLINE_STROKE_WIDTH,
  SIMPLE_DRAW_CONTROL_ID,
  SIMPLE_DRAW_LAYER_IDS,
  SIMPLE_DRAW_Z_INDEX,
  UNSET,
  type OlLayerLike,
  type OlMapLike,
} from './constants'
import { getMapWidgetProxy, triggerSimpleDraw } from './mapWidgetHost'

let originalSimpleDrawLayerStyle: unknown = UNSET

export function simpleDrawFeatureId(feature: unknown): unknown {
  if (feature == null || typeof feature !== 'object') return null
  const rec = feature as { getId?: () => unknown; id?: unknown; ol_uid?: unknown }
  if (typeof rec.getId === 'function') {
    const id = rec.getId()
    if (id != null) return id
  }
  return rec.id ?? rec.ol_uid ?? null
}

function makeOutlineStyle(colorHex: string): Style {
  return new Style({
    fill: new Fill({ color: OUTLINE_FILL_TRANSPARENT }),
    stroke: new Stroke({ color: colorHex, width: OUTLINE_STROKE_WIDTH }),
  })
}

function asOlMap(wrapper: unknown): OlMapLike | null {
  if (wrapper == null || typeof wrapper !== 'object') return null
  const rec = wrapper as { instance?: unknown; getLayers?: unknown }
  if (typeof rec.getLayers === 'function') return rec as OlMapLike
  const inst = rec.instance
  if (inst && typeof inst === 'object' && typeof (inst as OlMapLike).getLayers === 'function') {
    return inst as OlMapLike
  }
  return null
}

/** BasicMap.getLayers() is already an Array; ol.Map.getLayers() is a Collection with getArray(). */
function asLayerArray(raw: unknown): unknown[] {
  if (raw == null) return []
  if (Array.isArray(raw)) return raw
  if (typeof raw === 'object' && typeof (raw as { getArray?: () => unknown }).getArray === 'function') {
    const arr = (raw as { getArray: () => unknown }).getArray()
    return Array.isArray(arr) ? arr : []
  }
  return []
}

function collectLayers(root: unknown): OlLayerLike[] {
  const out: OlLayerLike[] = []
  const walk = (nodes: unknown[]): void => {
    for (const layer of nodes) {
      if (layer == null || typeof layer !== 'object') continue
      const rec = layer as OlLayerLike
      out.push(rec)
      const nested = rec.getLayers?.()
      if (nested != null) walk(asLayerArray(nested))
    }
  }
  walk(asLayerArray(root))
  return out
}

function layerIdentifier(layer: OlLayerLike): string | null {
  const id = layer.get?.(LAYER_ATTR_IDENTIFIER) ?? layer.get?.(LAYER_ATTR_ID)
  return typeof id === 'string' ? id : null
}

function layerOwnsDrawnFeatures(layer: OlLayerLike, owned: unknown[], uids: Set<unknown>): boolean {
  if (uids.size === 0) return false
  const layerFeats = layer.getSource?.()?.getFeatures?.() ?? []
  return layerFeats.some((lf) => {
    const featureId = simpleDrawFeatureId(lf)
    if (featureId != null && uids.has(featureId)) return true
    return owned.some((item) => item === lf)
  })
}

function findSimpleDrawLayer(features?: unknown[]): OlLayerLike | null {
  const proxy = getMapWidgetProxy()
  const rawMap = proxy?.$trigger?.(MAP_TRIGGER.getMapInstance, [geoinsightConfig.mapId])
  const layers = collectLayers(asOlMap(rawMap)?.getLayers?.())
  const owned = Array.isArray(features) ? features : []
  const uids = new Set<unknown>(owned.map(simpleDrawFeatureId).filter((id) => id != null))
  let fallback: OlLayerLike | null = null
  let match: OlLayerLike | null = null
  for (const rec of layers) {
    if (layerOwnsDrawnFeatures(rec, owned, uids) && match == null) match = rec
    const id = layerIdentifier(rec)
    if (id != null && SIMPLE_DRAW_LAYER_IDS.has(id) && fallback == null) fallback = rec
  }
  return match ?? fallback
}

function getDrawnFeaturesList(): unknown[] {
  const features = triggerSimpleDraw(
    MAP_TRIGGER.getDrawnFeatures,
    geoinsightConfig.mapId,
    SIMPLE_DRAW_CONTROL_ID
  )
  return Array.isArray(features) ? features : []
}

export function raiseGeoinsightSimpleDrawLayer(): void {
  findSimpleDrawLayer(getDrawnFeaturesList())?.setZIndex?.(SIMPLE_DRAW_Z_INDEX)
}

export function restoreSimpleDrawLayerStyle(): void {
  if (originalSimpleDrawLayerStyle === UNSET) return
  findSimpleDrawLayer()?.setStyle?.(originalSimpleDrawLayerStyle)
  originalSimpleDrawLayerStyle = UNSET
}

/** One outline-only simpledraw polygon (transparent fill) so SELECT/DELETE keep working. */
export function styleGeoinsightSimpleDrawOutline(colorHex: string): number {
  const list = getDrawnFeaturesList()
  const layer = findSimpleDrawLayer(list)
  const outline = makeOutlineStyle(colorHex)
  layer?.setZIndex?.(SIMPLE_DRAW_Z_INDEX)
  const layerStyle = layer?.getStyle?.()
  if (originalSimpleDrawLayerStyle === UNSET && layerStyle != null) {
    originalSimpleDrawLayerStyle = layerStyle
  }
  layer?.setStyle?.(() => outline)
  let styled = 0
  for (const feature of list) {
    const rec = feature as { setStyle?: (style: unknown) => void; changed?: () => void }
    rec.setStyle?.(outline)
    rec.changed?.()
    styled += 1
  }
  return styled
}
