/** Web Mercator scale at zoom 0 (shared by zoom parsing and viewport). */
export const WEB_MERCATOR_SCALE_BASE = 591657527.591555

export function webMercatorScaleForZoom(zoom: number): number {
  return WEB_MERCATOR_SCALE_BASE / 2 ** zoom
}
