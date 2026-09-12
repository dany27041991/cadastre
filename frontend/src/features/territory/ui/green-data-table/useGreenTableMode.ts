/**
 * Dual-mode / assets-only resolution for the green data table.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import type { GreenTableKind } from '../../lib/greenDetailColumnCatalog'
import type { GreenTableRawRow } from './GreenTableRowActions'
import {
  type DrillAreaScope,
  drillScopeFromAssetsTableQuery,
  drillScopeFromRow,
  withDrillAssetsQuery,
} from './greenTableDrillScope'

export type UseGreenTableModeArgs = {
  areasActive: boolean
  assetsActive: boolean
  areasTableQuery: string | null
  assetsTableQuery: string | null
  onOpenDetail?: (row: GreenTableRawRow, kind: 'area' | 'asset') => void
  setActiveTableKind: (kind: GreenTableKind) => void
}

export function useGreenTableMode({
  areasActive,
  assetsActive,
  areasTableQuery,
  assetsTableQuery,
  onOpenDetail,
  setActiveTableKind,
}: UseGreenTableModeArgs) {
  const dualMode = areasActive && assetsActive
  const [drillScope, setDrillScope] = useState<DrillAreaScope | null>(null)

  useEffect(() => {
    if (!dualMode) {
      setDrillScope(null)
    }
  }, [dualMode])

  // Search / map drill already scopes breadcrumb to a green area: align dual-mode
  // assets drill so the assets table uses the same green_area_id without a row click.
  useEffect(() => {
    if (!dualMode || assetsTableQuery == null) return
    const fromNav = drillScopeFromAssetsTableQuery(assetsTableQuery)
    setDrillScope(fromNav)
  }, [dualMode, assetsTableQuery])

  const showGreenAssets =
    (assetsActive && !areasActive) || (dualMode && drillScope != null)

  const tableKind: GreenTableKind = showGreenAssets ? 'asset' : 'area'

  useEffect(() => {
    setActiveTableKind(tableKind)
  }, [tableKind, setActiveTableKind])

  const baseQuery = useMemo(() => {
    if (showGreenAssets) {
      if (assetsTableQuery == null) return null
      if (drillScope != null) return withDrillAssetsQuery(assetsTableQuery, drillScope)
      return assetsTableQuery
    }
    return areasTableQuery
  }, [showGreenAssets, assetsTableQuery, areasTableQuery, drillScope])

  const handleViewAssets = useCallback((row: GreenTableRawRow) => {
    const scope = drillScopeFromRow(row)
    if (scope == null) return
    setDrillScope(scope)
  }, [])

  const handleDetail = useCallback(
    (row: GreenTableRawRow) => {
      onOpenDetail?.(row, showGreenAssets ? 'asset' : 'area')
    },
    [onOpenDetail, showGreenAssets],
  )

  const handleBackToAreas = useCallback(() => {
    setDrillScope(null)
  }, [])

  return {
    dualMode,
    drillScope,
    showGreenAssets,
    tableKind,
    baseQuery,
    handleViewAssets,
    handleDetail,
    handleBackToAreas,
  }
}
