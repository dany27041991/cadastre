import { useGeoinsightStore } from '@/app/store/useGeoinsightStore'
import { parseZoomFromCenterScale } from '../../parseMapZoom'
import { webMercatorScaleForZoom } from '../../mapZoomUtils'
import { GEOINSIGHT_EPSG_WGS84 } from '../../constants'
import { getGeoinsightMapId, getGeoinsightRef } from '../geoinsightMapRuntime'

export function syncGeoinsightZoomFromMap(): void {
  const ref = getGeoinsightRef()
  if (!ref?.getCenterAndScale) return
  const zoom = parseZoomFromCenterScale(ref.getCenterAndScale(getGeoinsightMapId()))
  if (zoom != null) useGeoinsightStore.getState().setMapZoom(zoom)
}

export function clampGeoinsightZoomToMax(maxZoom: number): void {
  const ref = getGeoinsightRef()
  if (!ref?.getCenterAndScale || !ref?.zoomToPoint) return
  const status = ref.getCenterAndScale(getGeoinsightMapId()) as
    | { center?: number[]; epsg?: string }
    | undefined
  const currentZoom = parseZoomFromCenterScale(status)
  if (currentZoom == null || currentZoom <= maxZoom) return
  const center = status?.center
  if (!center || center.length < 2) return
  ref.zoomToPoint(
    getGeoinsightMapId(),
    [center[0], center[1]],
    status?.epsg ?? GEOINSIGHT_EPSG_WGS84,
    webMercatorScaleForZoom(maxZoom)
  )
  window.setTimeout(() => syncGeoinsightZoomFromMap(), 200)
}
