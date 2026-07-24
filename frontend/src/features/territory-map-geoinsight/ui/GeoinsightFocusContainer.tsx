/**
 * Map focus wrapper — cu1.5 FocusContainerMap (layout + z-index; draw overlay when focus enabled).
 */
import { useEffect, useRef, type CSSProperties, type ReactNode } from 'react'
import { useGeoinsightStore } from '@/app/store/useGeoinsightStore'
import {
  GEOINSIGHT_MAP_Z_INDEX,
  STANDALONE_MAP_Z_INDEX,
  isStandaloneGeoinsightDev,
} from './geoinsightMapStyle'

interface GeoinsightFocusContainerProps {
  readonly children: ReactNode
}

const mapShellStyle: CSSProperties = {
  position: 'absolute',
  inset: 0,
  width: '100%',
  height: '100%',
  minHeight: 0,
  overflow: 'hidden',
}

export function GeoinsightFocusContainer({ children }: GeoinsightFocusContainerProps) {
  const mapFocus = useGeoinsightStore((s) => s.mapFocus)
  const mapWidgetRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    mapWidgetRef.current = document.querySelector('map-widget')
  }, [])

  const mapStackZIndex = mapFocus
    ? GEOINSIGHT_MAP_Z_INDEX.focused
    : isStandaloneGeoinsightDev()
      ? STANDALONE_MAP_Z_INDEX
      : GEOINSIGHT_MAP_Z_INDEX.normal

  useEffect(() => {
    if (!mapWidgetRef.current) return
    mapWidgetRef.current.style.zIndex = mapStackZIndex
  }, [mapStackZIndex])

  return (
    <>
      {mapFocus && (
        <div
          role="presentation"
          aria-hidden
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: '#000000b3',
            zIndex: GEOINSIGHT_MAP_Z_INDEX.overlay,
          }}
        />
      )}

      <div
        role="region"
        aria-label="Map view"
        className="col"
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          backgroundColor: 'inherit',
          padding: 0,
          overflow: 'hidden',
          zIndex: mapStackZIndex,
        }}
      >
        <div style={mapShellStyle}>{children}</div>
      </div>
    </>
  )
}
