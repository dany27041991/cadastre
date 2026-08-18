import type { ComponentStore, MapTriggerName, MapWidgetHost, MapWidgetProxy } from './constants'
import { COMPONENT_STORE_ID, MAP_WIDGET_TAG } from './constants'

export function getMapWidgetHost(): MapWidgetHost | null {
  return document.querySelector(MAP_WIDGET_TAG)
}

export function getMapWidgetProxy(): MapWidgetProxy | null {
  return getMapWidgetHost()?._instance?.proxy ?? null
}

export function getComponentStore(): ComponentStore | null {
  const host = getMapWidgetHost()
  const fromProxy = host?._instance?.proxy?.componentStore
  if (fromProxy) return fromProxy
  const pinia = host?._instance?.appContext?.app?.config?.globalProperties?.$pinia
  return pinia?._s?.get(COMPONENT_STORE_ID) ?? pinia?.state?.value?.componentStore ?? null
}

export function triggerSimpleDraw(
  name: MapTriggerName,
  mapId: unknown,
  ...rest: unknown[]
): unknown {
  return getMapWidgetProxy()?.$trigger?.(name, [mapId, ...rest])
}
