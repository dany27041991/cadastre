import {
  MAP_TRIGGER,
  SIMPLE_DRAW_CONTROL_ID,
  type MapWidgetTrigger,
} from './constants'
import { getMapWidgetHost } from './mapWidgetHost'
import { scheduleSyncDrawnGeometries, syncSimpleDrawWidgetDrawnGeometries } from './widgetLookup'

/** When true, toolbar close must not wipe the clip polygon (vendor passes clear=true). */
let keepSimpleDrawClipFeatures = false
let triggerGuardInstalled = false

function isKeepClearDeactivate(name: string, args: unknown[]): boolean {
  return (
    name === MAP_TRIGGER.deactivateDrawGeometry &&
    keepSimpleDrawClipFeatures &&
    Array.isArray(args) &&
    args[1] === SIMPLE_DRAW_CONTROL_ID &&
    args[2] === true
  )
}

function isKeepInitSimpleDraw(name: string, args: unknown[]): boolean {
  return (
    name === MAP_TRIGGER.initDrawGeometry &&
    keepSimpleDrawClipFeatures &&
    Array.isArray(args) &&
    args[1] != null &&
    typeof args[1] === 'object' &&
    (args[1] as { identifier?: string }).identifier === SIMPLE_DRAW_CONTROL_ID
  )
}

/**
 * Vendor SimpleDrawWidget.deactivateDrawGeometry always calls
 * deactivateDrawGeometry(mapId, id, true) which clearFeatures(). Closing the
 * toolbar would wipe the clip polygon; coerce clear→false while a clip is active.
 * Also re-sync drawnGeometries so SELECT stays enabled after reopen.
 */
export function installSimpleDrawDeactivateGuard(): void {
  if (triggerGuardInstalled) return
  const host = getMapWidgetHost()
  const proxy = host?._instance?.proxy
  const globalTrigger = host?._instance?.appContext?.app?.config?.globalProperties?.$trigger
  const targets: Array<{
    get: () => MapWidgetTrigger | undefined
    set: (fn: MapWidgetTrigger) => void
  }> = []
  if (proxy && typeof proxy.$trigger === 'function') {
    targets.push({
      get: () => proxy.$trigger,
      set: (fn) => {
        proxy.$trigger = fn
      },
    })
  }
  if (typeof globalTrigger === 'function') {
    const gp = host!._instance!.appContext!.app!.config!.globalProperties as {
      $trigger?: MapWidgetTrigger
    }
    targets.push({
      get: () => gp.$trigger,
      set: (fn) => {
        gp.$trigger = fn
      },
    })
  }
  if (targets.length === 0) return

  const wrap = (original: MapWidgetTrigger): MapWidgetTrigger => {
    return (name, args) => {
      if (isKeepClearDeactivate(name, args)) {
        const result = original(name, [args[0], args[1], false])
        syncSimpleDrawWidgetDrawnGeometries(args[0])
        return result
      }
      if (isKeepInitSimpleDraw(name, args)) {
        const result = original(name, args)
        scheduleSyncDrawnGeometries(args[0])
        return result
      }
      return original(name, args)
    }
  }

  const wrappedByOriginal = new Map<MapWidgetTrigger, MapWidgetTrigger>()
  for (const target of targets) {
    const current = target.get()
    if (typeof current !== 'function') continue
    let wrapped = wrappedByOriginal.get(current)
    if (wrapped == null) {
      wrapped = wrap(current)
      wrappedByOriginal.set(current, wrapped)
    }
    target.set(wrapped)
  }
  triggerGuardInstalled = true
}

export function setKeepGeoinsightSimpleDrawClipFeatures(keep: boolean): void {
  keepSimpleDrawClipFeatures = keep
  if (keep) installSimpleDrawDeactivateGuard()
}

export function clearKeepSimpleDrawClipFeatures(): void {
  keepSimpleDrawClipFeatures = false
}
