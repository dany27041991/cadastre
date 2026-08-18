import { getGeoinsightMapId, getGeoinsightRef } from './ref'

export function activateGeoinsightDrawPolygon(color: string): void {
  getGeoinsightRef()?.activateDrawGeometry?.(getGeoinsightMapId(), 'polygon', color)
}

export function deactivateGeoinsightDrawGeometry(): void {
  getGeoinsightRef()?.deactivateDrawGeometry?.(getGeoinsightMapId())
}

export function deleteAllGeoinsightDrawnGeometries(): void {
  getGeoinsightRef()?.deleteAllDrawnGeometries?.(getGeoinsightMapId())
}

export function zoomGeoinsightToWgs84Bbox(bbox: [number, number, number, number]): void {
  getGeoinsightRef()?.zoomToBBOX?.(getGeoinsightMapId(), {
    epsg: 'EPSG:4326',
    bbox,
  })
}
