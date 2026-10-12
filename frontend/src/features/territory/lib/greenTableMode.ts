/**
 * Pure helpers: which green table catalog is shown for layer toggle state.
 * Extracted from GreenDataTable for unit tests (no React).
 */
import type { GreenTableKind } from './greenDetailColumnCatalog'

export type GreenTableMode = {
  dualMode: boolean
  showGreenAssets: boolean
  tableKind: GreenTableKind
}

/** Assets-only, or dual mode after drilling into an area. */
export function resolveGreenTableMode(
  areasActive: boolean,
  assetsActive: boolean,
  drillAreaId: number | null,
): GreenTableMode {
  const dualMode = areasActive && assetsActive
  const showGreenAssets =
    (assetsActive && !areasActive) || (dualMode && drillAreaId != null)
  return {
    dualMode,
    showGreenAssets,
    tableKind: showGreenAssets ? 'asset' : 'area',
  }
}

/** Scope assets table query to a managed area (dual-mode drill). */
export function withGreenAreaId(territoryQuery: string, greenAreaId: number): string {
  const p = new URLSearchParams(territoryQuery)
  p.set('green_area_id', String(greenAreaId))
  return p.toString()
}
