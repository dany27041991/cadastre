import {
  CLOSED_DRAW_TYPES,
  SIMPLE_DRAW_TOOL_CONFIG_KEY,
  UNSET,
  type ComponentStore,
  type SimpleDrawConfig,
} from './constants'
import {
  clearKeepSimpleDrawClipFeatures,
  installSimpleDrawDeactivateGuard,
} from './clipKeepGuard'
import { getComponentStore } from './mapWidgetHost'
import { restoreSimpleDrawLayerStyle } from './layerOps'

let savedSimpleDrawConfig: SimpleDrawConfig | null | typeof UNSET = UNSET
let restrictRetryTimer: ReturnType<typeof setTimeout> | null = null

function readSimpleDrawConfig(store: ComponentStore): SimpleDrawConfig | undefined {
  return store.tools?.configs?.[SIMPLE_DRAW_TOOL_CONFIG_KEY]
}

function writeSimpleDrawConfig(store: ComponentStore, next: SimpleDrawConfig | undefined): boolean {
  const tools = store.tools
  if (tools == null) return false
  const configs = { ...(tools.configs ?? {}) }
  if (next == null) {
    delete configs[SIMPLE_DRAW_TOOL_CONFIG_KEY]
  } else {
    configs[SIMPLE_DRAW_TOOL_CONFIG_KEY] = next
  }
  const patched = { ...tools, configs }
  if (typeof store.$patch === 'function') {
    store.$patch({ tools: patched })
  } else {
    store.tools = patched
  }
  return true
}

function snapshotConfig(current: SimpleDrawConfig | undefined): SimpleDrawConfig | null {
  if (current == null) return null
  return {
    ...current,
    geometries: current.geometries ? [...current.geometries] : undefined,
  }
}

export function restrictGeoinsightSimpleDrawToClosedShapes(): boolean {
  if (restrictRetryTimer != null) {
    clearTimeout(restrictRetryTimer)
    restrictRetryTimer = null
  }
  installSimpleDrawDeactivateGuard()
  const store = getComponentStore()
  if (store?.tools == null) {
    restrictRetryTimer = setTimeout(() => {
      restrictRetryTimer = null
      restrictGeoinsightSimpleDrawToClosedShapes()
    }, 200)
    return false
  }
  if (savedSimpleDrawConfig === UNSET) {
    savedSimpleDrawConfig = snapshotConfig(readSimpleDrawConfig(store))
  }
  return writeSimpleDrawConfig(store, {
    ...(readSimpleDrawConfig(store) ?? {}),
    geometries: [...CLOSED_DRAW_TYPES],
    multiple_draw: true,
  })
}

export function restoreGeoinsightSimpleDrawTools(): void {
  if (restrictRetryTimer != null) {
    clearTimeout(restrictRetryTimer)
    restrictRetryTimer = null
  }
  clearKeepSimpleDrawClipFeatures()
  if (savedSimpleDrawConfig === UNSET) return
  const store = getComponentStore()
  const snapshot = savedSimpleDrawConfig
  savedSimpleDrawConfig = UNSET
  if (store?.tools == null) return
  writeSimpleDrawConfig(store, snapshot == null ? undefined : snapshot)
  restoreSimpleDrawLayerStyle()
}
