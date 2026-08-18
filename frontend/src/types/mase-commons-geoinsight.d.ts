/**
 * Minimal typings for @mase/commons-geoinsight (cu1.5-fe pattern).
 */
declare module '@mase/commons-geoinsight' {
  import type { CSSProperties, RefObject } from 'react'

  export interface GeoinsightRef {
    getCenterAndScale?: (mapId: number) => {
      epsg?: string
      zoom?: number
      level?: number
      scale?: number
      center?: number[]
    } | undefined
    addGeometries?: (mapId: number, geometries: unknown[]) => void
    removeGeometries?: (mapId: number, geomIds: string[]) => void
    zoomToBBOX?: (mapId: number, options: { epsg: string; bbox: number[] }) => void
    zoomToPoint?: (mapId: number, coordinates: number[], epsg: string, scale?: number) => void
    activateDrawGeometry?: (mapId: number, geometryType?: string, color?: string) => void
    deactivateDrawGeometry?: (mapId: number) => void
    deleteAllDrawnGeometries?: (mapId: number) => void
    deleteDrawnGeometries?: (mapId: number) => void
    activateDrawnGeometryInfo?: (mapId: number) => void
    deactivateDrawnGeometryInfo?: (mapId: number) => void
    setMapVisible?: (mapId: number, visible: boolean) => void | Promise<void>
    setMapActive?: (mapId: number) => void
    setGeometryLabelVisibility?: (mapId: number, visible: boolean) => void
  }

  export interface GeoinsightProps {
    webgis_id: number
    cu_id: string
    ref?: RefObject<GeoinsightRef | null>
    style?: CSSProperties
    onGetFeatureInfo?: (event: unknown) => void
    onPointerCoordsChange?: (mapId: number, epsg: string, coords: string) => void
    onGenericEvent?: {
      events: string[]
      callbackFunction: (eventName: string, event: CustomEvent) => void
    }
    onGeometryDrawn?: (
      mapId: number,
      geomId: string,
      color: string,
      clip: Record<string, unknown>
    ) => void
    onSimpleFeatureDrawn?: (current: unknown[], deleted?: unknown[]) => void
    onDrawnGeometryInfo?: (
      mapId: number,
      coordinates: number[],
      epsg: string,
      features: unknown[]
    ) => void
  }

  export function Geoinsight(props: GeoinsightProps): JSX.Element

  export function useRefGeoinsight(mode?: string): {
    ref: RefObject<GeoinsightRef | null>
  }

  export function initGeoinsightModule(): Promise<unknown>
}
