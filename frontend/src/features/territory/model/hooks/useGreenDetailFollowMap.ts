/**
 * Reprojects the green-detail geographic anchor to screen coords on every map move.
 * Uses OpenLayers `postrender` when available so the panel tracks DragPan live
 * (Geoinsight getCenterAndScale only updates after the pan settles).
 */
import { useEffect, useRef } from 'react'
import { useGeoinsightStore } from '@/app/store/useGeoinsightStore'
import {
  getLiveOlMap,
  lonLatToClientPoint,
} from '@/features/territory/lib/greenDetailMapAnchor'

const FOLLOW_INTERVAL_MS = 32

export function useGreenDetailFollowMap(
  enabled: boolean,
  anchorLon: number | null | undefined,
  anchorLat: number | null | undefined,
  onScreen: (clientX: number, clientY: number) => void
): void {
  const mapViewEpoch = useGeoinsightStore((s) => s.mapViewEpoch)
  const mapZoom = useGeoinsightStore((s) => s.mapZoom)
  const onScreenRef = useRef(onScreen)
  onScreenRef.current = onScreen
  const lastScreenRef = useRef<{ clientX: number; clientY: number } | null>(null)

  useEffect(() => {
    if (!enabled || anchorLon == null || anchorLat == null) return
    if (!Number.isFinite(anchorLon) || !Number.isFinite(anchorLat)) return

    let projectCount = 0
    const project = () => {
      const point = lonLatToClientPoint(anchorLon, anchorLat)
      if (!point) return
      const prev = lastScreenRef.current
      if (prev && prev.clientX === point.clientX && prev.clientY === point.clientY) return
      lastScreenRef.current = point
      projectCount += 1
      // #region agent log
      if (projectCount <= 8) {
        fetch('http://127.0.0.1:7455/ingest/ee4d7135-3aef-4e11-b07a-3de89c3bf62c',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'4fe799'},body:JSON.stringify({sessionId:'4fe799',runId:'asset-pos',hypothesisId:'H1-race',location:'useGreenDetailFollowMap:project',message:'follow_map_screen',data:{n:projectCount,anchorLon,anchorLat,point,prev,innerW:window.innerWidth,innerH:window.innerHeight},timestamp:Date.now()})}).catch(()=>{})
      }
      // #endregion
      onScreenRef.current(point.clientX, point.clientY)
    }

    project()

    const map = getLiveOlMap()
    if (map?.on && map.un) {
      map.on('postrender', project)
      return () => {
        map.un?.('postrender', project)
      }
    }

    const timer = window.setInterval(project, FOLLOW_INTERVAL_MS)
    return () => window.clearInterval(timer)
  }, [enabled, anchorLon, anchorLat, mapViewEpoch, mapZoom])
}
