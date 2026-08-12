/**
 * Mount / hide green area polygons on the map bridge (respects Aree / Asset toggles).
 */
import { useCallback, type MutableRefObject } from 'react'
import type { TerritoryMapFeature } from '../../types/mapFeature'
import type { MapBridge } from '../../types'

export type GreenLayerDisplayOptions = {
  includeTerritoryBbox?: boolean
  force?: boolean
  skipFit?: boolean
}

export function useGreenLayerDisplay(
  bridgeRef: MutableRefObject<MapBridge>,
  areasActiveRef: MutableRefObject<(() => boolean) | undefined>,
  assetsActiveRef: MutableRefObject<(() => boolean) | undefined>
) {
  const showGreenLayer = useCallback(
    (
      geojson: Parameters<MapBridge['loadGreenLayer']>[0],
      options?: GreenLayerDisplayOptions
    ) => {
      const areasOn = areasActiveRef.current?.() ?? true
      const assetsOn = assetsActiveRef.current?.() ?? false
      if (!areasOn && !options?.force) {
        if (!assetsOn) {
          bridgeRef.current.clearGreenLayer()
          bridgeRef.current.setGreenLayerVisible(false)
        }
        return
      }
      bridgeRef.current.loadGreenLayer(geojson, { skipFit: true })
      bridgeRef.current.setGreenLayerVisibleWhenMoveEnds()
      if (options?.skipFit) {
        bridgeRef.current.setGreenLayerVisible(true)
        return
      }
      bridgeRef.current.fitToGreenExtent(options?.includeTerritoryBbox ?? true)
      bridgeRef.current.ensureGreenLayerVisibleAfterFit()
    },
    [bridgeRef, areasActiveRef, assetsActiveRef]
  )

  const showLeafAreaFromFeature = useCallback(
    (feat: TerritoryMapFeature, options?: GreenLayerDisplayOptions) => {
      const areasOn = areasActiveRef.current?.() ?? true
      const assetsOn = assetsActiveRef.current?.() ?? false
      if (!areasOn && !options?.force) {
        if (!assetsOn) {
          bridgeRef.current.clearGreenLayer()
          bridgeRef.current.setGreenLayerVisible(false)
        }
        return
      }
      bridgeRef.current.loadGreenLayerFromFeature(feat, { skipFit: true })
      bridgeRef.current.setGreenLayerVisible(true)
      if (options?.skipFit) return
      bridgeRef.current.fitToGreenExtent(options?.includeTerritoryBbox ?? true)
    },
    [bridgeRef, areasActiveRef, assetsActiveRef]
  )

  return { showGreenLayer, showLeafAreaFromFeature }
}
