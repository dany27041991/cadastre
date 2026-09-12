/**
 * Draw-mode spatial clip: WKT polygon from simpledraw / geometry callbacks.
 */
import { useCallback, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'react-toastify'
import {
  bboxFromPolygon,
  clipFromSimpleDrawCurrent,
  clipPayloadToPolygon,
  polygonToWkt,
} from '@/features/territory/lib/spatialClipWkt'
import type { SpatialClipPolygon } from '@/features/territory/lib/spatialClipWkt'
import type { TerritoryEntryMode } from '@/features/territory/context/GreenTablePanelContext'
import { DRAW_CLIP_GEOMETRY_COLOR } from '@/features/territory-map-geoinsight/model/constants'
import type { UseGeoinsightMapBridgeResult } from '@/features/territory-map-geoinsight'
import { useGeoinsightStore } from '@/app/store/useGeoinsightStore'

export type UseTerritoryMapDrawClipArgs = {
  map: UseGeoinsightMapBridgeResult
  entryMode: TerritoryEntryMode
  spatialClip: SpatialClipPolygon | null
  setSpatialClip: (polygon: SpatialClipPolygon | null) => void
}

export function useTerritoryMapDrawClip({
  map,
  entryMode,
  spatialClip,
  setSpatialClip,
}: UseTerritoryMapDrawClipArgs) {
  const { t } = useTranslation()
  const entryModeRef = useRef(entryMode)
  entryModeRef.current = entryMode
  const spatialClipRef = useRef(spatialClip)
  spatialClipRef.current = spatialClip

  useEffect(() => {
    if (entryMode !== 'draw') {
      map.restoreSimpleDrawTools()
      map.deactivateDrawGeometry()
      map.deleteAllDrawnGeometries()
      map.clearSimpleDrawGeometries()
      map.clearDrawClip()
      return
    }
    map.restrictSimpleDrawToClosedShapes()
    if (spatialClip != null) {
      map.deactivateDrawGeometry()
      map.deleteAllDrawnGeometries()
      // Selection is the blue CL_draw overlay; simpledraw draft stays cleared.
      return
    }
    map.deactivateDrawGeometry()
    map.deleteAllDrawnGeometries()
    map.clearSimpleDrawGeometries()
    map.clearDrawClip()
  }, [entryMode, spatialClip, map])

  const handleGeometryDrawn = useCallback(
    (_mapId: number, _geomId: string, _color: string, clip: Record<string, unknown>) => {
      if (entryModeRef.current !== 'draw') return
      const mapEpsg = useGeoinsightStore.getState().crs
      const polygon = clipPayloadToPolygon(clip, mapEpsg)
      if (polygon == null) {
        toast.error(t('territory.panel.draw.invalidGeometry'))
        return
      }
      try {
        polygonToWkt(polygon)
      } catch {
        toast.error(t('territory.panel.draw.invalidGeometry'))
        return
      }
      map.deactivateDrawGeometry()
      map.deleteAllDrawnGeometries()
      // Single simpledraw polygon (outline, no fill). No CL_draw duplicate.
      map.clearDrawClip()
      map.styleSimpleDrawOutline(DRAW_CLIP_GEOMETRY_COLOR)
      map.deactivateSimpleDrawTool()
      map.setKeepSimpleDrawClipFeatures(true)
      setSpatialClip(polygon)
      const bbox = bboxFromPolygon(polygon)
      map.zoomToLonLatAtScreenFraction((bbox[0] + bbox[2]) / 2, (bbox[1] + bbox[3]) / 2, {
        bbox,
      })
    },
    [map, setSpatialClip, t],
  )

  const handleSimpleFeatureDrawn = useCallback(
    (current: unknown[], deleted?: unknown[]) => {
      const currentLen = Array.isArray(current) ? current.length : 0
      const deletedLen = Array.isArray(deleted) ? deleted.length : 0
      const clip = clipFromSimpleDrawCurrent(current)
      if (currentLen === 0) {
        if (entryModeRef.current !== 'draw' || spatialClipRef.current == null) return
        // Intentional SELECT+DELETE only. Toolbar close is blocked by keep-clip guard.
        if (deletedLen === 0) {
          return
        }
        map.setKeepSimpleDrawClipFeatures(false)
        map.clearDrawClip()
        map.clearSimpleDrawGeometries()
        setSpatialClip(null)
        return
      }
      if (currentLen > 1) {
        map.keepOnlyLastSimpleDrawGeometry()
      }
      if (clip == null) return
      handleGeometryDrawn(0, 'simpledraw', DRAW_CLIP_GEOMETRY_COLOR, clip)
    },
    [handleGeometryDrawn, map, setSpatialClip],
  )

  return {
    handleGeometryDrawn,
    handleSimpleFeatureDrawn,
  }
}
