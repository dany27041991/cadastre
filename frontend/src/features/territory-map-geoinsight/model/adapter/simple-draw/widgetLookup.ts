import { geoinsightConfig } from '@/app/config/geoinsight'
import {
  MAP_TRIGGER,
  SIMPLE_DRAW_CONTROL_ID,
  SIMPLE_DRAW_WIDGET_REF,
  SIMPLE_DRAW_WIDGET_SELECTORS,
  type SimpleDrawWidgetLike,
} from './constants'
import { getMapWidgetHost, getMapWidgetProxy, triggerSimpleDraw } from './mapWidgetHost'

let cachedSimpleDrawWidget: SimpleDrawWidgetLike | null = null

function isSimpleDrawWidget(value: unknown): value is SimpleDrawWidgetLike {
  if (value == null || typeof value !== 'object') return false
  const rec = value as SimpleDrawWidgetLike
  if (rec.drawControlIdentifier === SIMPLE_DRAW_CONTROL_ID) return true
  return Array.isArray(rec.drawnGeometries) && typeof rec.selectGeometryType === 'function'
}

function firstSimpleDrawAmong(candidates: unknown[]): SimpleDrawWidgetLike | null {
  for (const candidate of candidates) {
    if (isSimpleDrawWidget(candidate)) return candidate
    if (candidate != null && typeof candidate === 'object') {
      const nested = (candidate as { proxy?: unknown }).proxy
      if (isSimpleDrawWidget(nested)) return nested
    }
  }
  return null
}

function walkVueForSimpleDraw(node: unknown, depth = 0): SimpleDrawWidgetLike | null {
  if (node == null || depth > 60) return null
  const rec = node as {
    proxy?: unknown
    ctx?: unknown
    setupState?: unknown
    subTree?: unknown
    component?: unknown
    children?: unknown
    dynamicChildren?: unknown[]
    suspense?: { activeBranch?: unknown }
  }
  const hit = firstSimpleDrawAmong([rec.proxy, rec.ctx, rec.setupState])
  if (hit) return hit

  const next: unknown[] = []
  if (rec.subTree) next.push(rec.subTree)
  if (rec.component) next.push(rec.component)
  if (rec.suspense?.activeBranch) next.push(rec.suspense.activeBranch)
  if (Array.isArray(rec.dynamicChildren)) next.push(...rec.dynamicChildren)
  if (Array.isArray(rec.children)) {
    next.push(...rec.children)
  } else if (rec.children != null && typeof rec.children === 'object') {
    const kids = rec.children as { default?: unknown }
    if (typeof kids.default === 'function') {
      try {
        const rendered = (kids.default as () => unknown)()
        if (Array.isArray(rendered)) next.push(...rendered)
        else if (rendered) next.push(rendered)
      } catch {
        /* ignore slot render */
      }
    } else {
      next.push(rec.children)
    }
  }
  for (const child of next) {
    const found = walkVueForSimpleDraw(child, depth + 1)
    if (found) return found
  }
  return null
}

function vueProxyFromElement(el: Element | null): SimpleDrawWidgetLike | null {
  if (el == null) return null
  const rec = el as unknown as {
    __vueParentComponent?: { proxy?: unknown; ctx?: unknown }
    _vnode?: { component?: { proxy?: unknown } }
  }
  const hit = firstSimpleDrawAmong([
    rec.__vueParentComponent?.proxy,
    rec.__vueParentComponent?.ctx,
    rec._vnode?.component?.proxy,
  ])
  if (hit) return hit

  let cur: Element | null = el
  for (let i = 0; i < 8 && cur; i += 1) {
    const parent = (cur as unknown as { __vueParentComponent?: { proxy?: unknown } })
      .__vueParentComponent?.proxy
    if (isSimpleDrawWidget(parent)) return parent
    cur = cur.parentElement
  }
  return null
}

function widgetFromRefs(refs: Record<string, unknown> | null | undefined): SimpleDrawWidgetLike | null {
  if (refs == null) return null
  const raw = refs[SIMPLE_DRAW_WIDGET_REF]
  const widget = Array.isArray(raw) ? raw[0] : raw
  return isSimpleDrawWidget(widget) ? widget : null
}

function cacheAndReturn(widget: SimpleDrawWidgetLike): SimpleDrawWidgetLike {
  cachedSimpleDrawWidget = widget
  return widget
}

function querySimpleDrawElement(root: ParentNode): Element | null {
  for (const selector of SIMPLE_DRAW_WIDGET_SELECTORS) {
    const el = root.querySelector(selector)
    if (el != null) return el
  }
  return null
}

export function findSimpleDrawWidget(): SimpleDrawWidgetLike | null {
  if (cachedSimpleDrawWidget != null && isSimpleDrawWidget(cachedSimpleDrawWidget)) {
    return cachedSimpleDrawWidget
  }
  const host = getMapWidgetHost()
  const proxy = getMapWidgetProxy()
  const fromWalk =
    walkVueForSimpleDraw(host?._instance) ??
    walkVueForSimpleDraw((host?._instance as { subTree?: unknown } | undefined)?.subTree)
  if (fromWalk) return cacheAndReturn(fromWalk)

  const mapId = geoinsightConfig.mapId
  const mapRef =
    proxy?.viewerStore?.getMapStoreById?.(mapId)?.mapRef ?? proxy?.viewerStore?.activeMapStore?.mapRef
  if (typeof mapRef === 'string' && typeof proxy?.getMapContainerCmpByRef === 'function') {
    const fromContainer = widgetFromRefs(proxy.getMapContainerCmpByRef(mapRef)?.$refs)
    if (fromContainer) return cacheAndReturn(fromContainer)
  }

  const roots: ParentNode[] = host?.shadowRoot ? [host.shadowRoot, document] : [document]
  for (const root of roots) {
    const fromEl = vueProxyFromElement(querySimpleDrawElement(root))
    if (fromEl) return cacheAndReturn(fromEl)
  }
  return null
}

function geometriesFromDrawnFeatures(mapId: unknown): unknown[] {
  const features = triggerSimpleDraw(MAP_TRIGGER.getDrawnFeatures, mapId, SIMPLE_DRAW_CONTROL_ID)
  if (!Array.isArray(features) || features.length === 0) return []
  return features
    .map((feature) => {
      const rec = feature as { getGeometry?: () => unknown }
      return typeof rec.getGeometry === 'function' ? rec.getGeometry() : null
    })
    .filter((geometry) => geometry != null)
}

/** SELECT is gated on widget.drawnGeometries.length; restore it from OL features. */
export function syncSimpleDrawWidgetDrawnGeometries(mapId: unknown): number {
  const got = triggerSimpleDraw(MAP_TRIGGER.getDrawnGeometries, mapId, SIMPLE_DRAW_CONTROL_ID) as
    | { geometries?: unknown[] }
    | undefined
  let geometries = Array.isArray(got?.geometries) ? got.geometries : []
  if (geometries.length === 0) geometries = geometriesFromDrawnFeatures(mapId)
  const widget = findSimpleDrawWidget()
  if (widget == null) return 0
  widget.drawnGeometries = Array.from(geometries)
  return geometries.length
}

export function scheduleSyncDrawnGeometries(mapId: unknown): void {
  if (syncSimpleDrawWidgetDrawnGeometries(mapId) !== 0) return
  queueMicrotask(() => {
    syncSimpleDrawWidgetDrawnGeometries(mapId)
  })
  setTimeout(() => {
    syncSimpleDrawWidgetDrawnGeometries(mapId)
  }, 50)
}
