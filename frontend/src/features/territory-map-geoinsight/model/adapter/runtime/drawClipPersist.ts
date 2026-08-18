import type { GeoinsightRef } from '@mase/commons-geoinsight'
import type { GeoinsightGeometryClip } from '@/features/territory/lib/geoJsonToGeoinsight'
import {
  DRAW_CLIP_GEOM_ID,
  DRAW_CLIP_GEOMETRY_COLOR,
  GEOINSIGHT_EPSG_WGS84,
} from '../../constants'
import { getGeoinsightMapId, getGeoinsightRef } from './ref'

let persistedDrawClip: GeoinsightGeometryClip | null = null

export function reassertPersistedDrawClip(
  ref: GeoinsightRef | null | undefined,
  mapId: number
): void {
  if (!persistedDrawClip || !ref) return
  ref.removeGeometries?.(mapId, [persistedDrawClip.geom_id])
  ref.addGeometries?.(mapId, [persistedDrawClip])
}

export function persistGeoinsightDrawClip(wkt: string, color = DRAW_CLIP_GEOMETRY_COLOR): void {
  persistedDrawClip = {
    type: 'WKT',
    data: wkt,
    geom_id: DRAW_CLIP_GEOM_ID,
    epsg: GEOINSIGHT_EPSG_WGS84,
    color,
    // Vendor falls back to geom_id ("CL_draw") when label is empty.
    label: '\u2800',
    geom_label: '\u2800',
    hide_label: true,
    show_label: false,
    label_visibility: false,
    label_color: '#00000000',
    label_border_color: '#00000000',
  }
  const ref = getGeoinsightRef()
  const mapId = getGeoinsightMapId()
  reassertPersistedDrawClip(ref, mapId)
}

export function clearPersistedGeoinsightDrawClip(): void {
  const id = persistedDrawClip?.geom_id
  persistedDrawClip = null
  if (id) getGeoinsightRef()?.removeGeometries?.(getGeoinsightMapId(), [id])
}
