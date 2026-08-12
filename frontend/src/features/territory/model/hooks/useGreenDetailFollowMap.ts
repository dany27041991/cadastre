/**
 * Reprojects the green-detail geographic anchor to screen coords on every map move.
 */
import { useEffect, useRef } from 'react'
import { useGeoinsightStore } from '@/app/store/useGeoinsightStore'
import { lonLatToClientPoint } from '@/features/territory/lib/greenDetailMapAnchor'

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

  useEffect(() => {
    if (!enabled || anchorLon == null || anchorLat == null) return
    if (!Number.isFinite(anchorLon) || !Number.isFinite(anchorLat)) return

    const project = () => {
      const point = lonLatToClientPoint(anchorLon, anchorLat)
      if (!point) return
      onScreenRef.current(point.clientX, point.clientY)
    }

    project()
    const timer = window.setInterval(project, FOLLOW_INTERVAL_MS)
    return () => window.clearInterval(timer)
  }, [enabled, anchorLon, anchorLat, mapViewEpoch, mapZoom])
}
