import type { CSSProperties } from 'react'

/** Shell offset from @mase/commons-utility (cu1.5 uses HEIGHT_BODY - 50px). */
const SHELL_HEIGHT_BODY = 'calc(100vh - 222px)'

/** True when running Vite dev/build entry (not webpack single-spa bundle). */
export function isStandaloneGeoinsightDev(): boolean {
  return import.meta.env.VITE_STANDALONE === 'true' || Boolean(import.meta.env.DEV)
}

export function createGeoinsightMapStyle(): CSSProperties {
  if (isStandaloneGeoinsightDev()) {
    return {
      position: 'absolute',
      inset: 0,
      width: '100%',
      height: '100%',
      minHeight: '100%',
      marginTop: 0,
    }
  }

  return {
    position: 'relative',
    width: '100%',
    minHeight: `calc(${SHELL_HEIGHT_BODY} - 50px)`,
    height: `calc(${SHELL_HEIGHT_BODY} - 50px)`,
    marginTop: 0,
  }
}

/** cu1.5 FocusContainerMap z-index stack. */
export const GEOINSIGHT_MAP_Z_INDEX = {
  normal: '700',
  focused: '1035',
  overlay: '1030',
} as const

/** Map z-index in standalone Vite dev (no MASE shell overlay stack). */
export const STANDALONE_MAP_Z_INDEX = '1'

/** dxc-webkit map accordion / overlays above Geoinsight in standalone dev. */
export const MAP_UI_OVERLAY_Z_INDEX = 750
