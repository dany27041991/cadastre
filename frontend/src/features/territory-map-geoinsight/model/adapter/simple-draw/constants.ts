/** Geoinsight simpledraw — vendor identifiers, $trigger events, DOM selectors. */

export const SIMPLE_DRAW_CONTROL_ID = 'simpleDrawControl'
export const DRAW_GEOMETRY_LAYER_ID = 'drawGeometry'
export const SIMPLE_DRAW_TOOL_CONFIG_KEY = 'simpledraw'
export const COMPONENT_STORE_ID = 'componentStore'
export const MAP_WIDGET_TAG = 'map-widget'
export const SIMPLE_DRAW_WIDGET_REF = 'simpleDrawWidget'

export const SIMPLE_DRAW_WIDGET_SELECTORS = [
  '.simple-draw-widget',
  '.mw-simple-draw-container',
] as const

export const CLOSED_DRAW_TYPES = ['rectangle', 'polygon', 'circle'] as const

/** Above green temp geometries (vendor layerZIndex 2000). */
export const SIMPLE_DRAW_Z_INDEX = 10000

export const SIMPLE_DRAW_LAYER_IDS = new Set([SIMPLE_DRAW_CONTROL_ID, DRAW_GEOMETRY_LAYER_ID])

export const LAYER_ATTR_IDENTIFIER = 'identifier'
export const LAYER_ATTR_ID = 'id'

export const OUTLINE_FILL_TRANSPARENT = 'rgba(0,0,0,0)'
export const OUTLINE_STROKE_WIDTH = 3

/** Vendor EventManager / map-widget $trigger names used by simpledraw. */
export const MAP_TRIGGER = {
  deactivateDrawGeometry: 'deactivateDrawGeometry',
  initDrawGeometry: 'initDrawGeometry',
  clearDrawnGeometries: 'clearDrawnGeometries',
  clearDrawnGeometriesByIds: 'clearDrawnGeometriesByIds',
  getDrawnFeatures: 'getDrawnFeatures',
  getDrawnGeometries: 'getDrawnGeometries',
  getMapInstance: 'getMapInstance',
} as const

export type MapTriggerName = (typeof MAP_TRIGGER)[keyof typeof MAP_TRIGGER]

export type SimpleDrawConfig = {
  geometries?: string[]
  multiple_draw?: boolean
}

export type ComponentStore = {
  initialized?: boolean
  tools?: {
    enabled?: string[]
    configs?: Record<string, SimpleDrawConfig | undefined>
  } | null
  $patch?: (partial: { tools: ComponentStore['tools'] }) => void
}

export type MapWidgetTrigger = (name: string, args: unknown[]) => unknown

export type MapWidgetProxy = {
  componentStore?: ComponentStore
  $trigger?: MapWidgetTrigger
  viewerStore?: {
    getMapStoreById?: (id: number) => { mapRef?: string } | null | undefined
    activeMapStore?: { mapRef?: string }
  }
  getMapContainerCmpByRef?: (mapRef: string) => {
    $refs?: Record<string, unknown>
  } | null
}

export type SimpleDrawWidgetLike = {
  drawnGeometries?: unknown[]
  drawControlIdentifier?: string
  selectGeometryType?: (geometryType: unknown) => void
}

export type MapWidgetHost = HTMLElement & {
  _instance?: {
    proxy?: MapWidgetProxy
    appContext?: {
      app?: {
        config?: {
          globalProperties?: {
            $pinia?: {
              _s?: Map<string, ComponentStore>
              state?: { value?: { componentStore?: ComponentStore } }
            }
            $trigger?: MapWidgetTrigger
          }
        }
      }
    }
  }
}

export type OlLayerLike = {
  get?: (key: string) => unknown
  getStyle?: () => unknown
  setStyle?: (style: unknown) => void
  setZIndex?: (z: number) => void
  getSource?: () => { getFeatures?: () => unknown[] }
  getLayers?: () => unknown
}

export type OlMapLike = {
  getLayers?: () => unknown
}

export const UNSET = Symbol('simpledraw-unset')
