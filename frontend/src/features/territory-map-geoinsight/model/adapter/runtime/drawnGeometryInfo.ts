import { getMapWidgetProxy } from '../geoinsightSimpleDrawTools'
import { runGeoinsightOrQueue } from './pendingQueue'
import { getGeoinsightMapId, getGeoinsightRef } from './ref'
import type { GeoinsightMapRuntimeHost } from './types'

export function activateGeoinsightDrawnGeometryInfo(host: GeoinsightMapRuntimeHost): void {
  runGeoinsightOrQueue(host, () => {
    const mapId = getGeoinsightMapId()
    const proxy = getMapWidgetProxy()
    // Geoinsight React/API activateDrawnGeometryInfo always runs deactivateMapControls,
    // which calls deactivateSimpleDrawWidget → clearFeatures(true) and wipes the draw clip.
    // Activate the click control via map-widget $trigger instead (same control, no clear).
    if (typeof proxy?.$trigger === 'function') {
      proxy.$trigger('deactivateDrawnGeometryInfo', [mapId])
      proxy.$trigger('activateDrawnGeometryInfo', [
        mapId,
        {
          onClick: (event: {
            mapId?: number
            coordinates?: number[]
            epsg?: string
            features?: unknown
          }) => {
            host.handleDrawnGeometryInfo(
              event?.mapId ?? mapId,
              event?.coordinates ?? [],
              event?.epsg ?? '',
              event?.features
            )
          },
        },
      ])
      return
    }
    const ref = getGeoinsightRef()
    if (!ref?.activateDrawnGeometryInfo) return
    ref.deactivateDrawnGeometryInfo?.(mapId)
    ref.activateDrawnGeometryInfo(mapId)
  })
}
