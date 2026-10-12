/**
 * Pure helpers: which map viewport mode to start for layer toggles.
 * Mirrors decisions in useGreenAssetsLayer (testable without React/Geoinsight).
 */
export type GreenViewportMode = 'off' | 'areas_only' | 'assets' | 'assets_with_areas'

export function resolveGreenViewportMode(opts: {
  assetsActive: boolean
  areasActive: boolean
  /** False when draw mode requires clip and none is set. */
  clipReady: boolean
}): GreenViewportMode {
  if (!opts.clipReady) return 'off'
  if (opts.assetsActive) {
    return opts.areasActive ? 'assets_with_areas' : 'assets'
  }
  if (opts.areasActive) return 'areas_only'
  return 'off'
}

/** Areas companion fetch gate (same rule as refreshGreenViewport). */
export function shouldFetchAreasViewport(
  areasFetcherPresent: boolean,
  zoom: number,
  minZoom: number,
): boolean {
  return areasFetcherPresent && zoom >= minZoom
}
