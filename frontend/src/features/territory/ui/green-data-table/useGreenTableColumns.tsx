/**
 * Visible columns + projected rows for CustomTable.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { NON_SORTABLE_DETAIL_COLUMNS, type GreenTableKind } from '../../lib/greenDetailColumnCatalog'
import {
  loadVisibleColumns,
  orderVisibleKeys,
  toggleVisibleColumn,
} from '../../lib/greenTableVisibleCols'
import { GreenTableRowActions, type GreenTableRawRow } from './GreenTableRowActions'
import { cellValue, type GreenTableRow } from './greenTableCellFormat'

export type UseGreenTableColumnsArgs = {
  tableKind: GreenTableKind
  dualMode: boolean
  showGreenAssets: boolean
  rawRows: Record<string, unknown>[]
  formatBoolean: (b: boolean) => string
  onOpenDetail?: (row: GreenTableRawRow, kind: 'area' | 'asset') => void
  handleDetail: (row: GreenTableRawRow) => void
  handleViewAssets: (row: GreenTableRawRow) => void
}

export function useGreenTableColumns({
  tableKind,
  dualMode,
  showGreenAssets,
  rawRows,
  formatBoolean,
  onOpenDetail,
  handleDetail,
  handleViewAssets,
}: UseGreenTableColumnsArgs) {
  const { t } = useTranslation()
  const [visibleKeys, setVisibleKeys] = useState<string[]>(() => loadVisibleColumns('area'))
  const [pickingColumns, setPickingColumns] = useState(false)

  useEffect(() => {
    setVisibleKeys(loadVisibleColumns(tableKind))
    setPickingColumns(false)
  }, [tableKind])

  const handleToggleColumn = useCallback(
    (key: string) => {
      setVisibleKeys((prev) => toggleVisibleColumn(tableKind, prev, key))
    },
    [tableKind],
  )

  const orderedVisibleKeys = useMemo(
    () => orderVisibleKeys(tableKind, visibleKeys),
    [tableKind, visibleKeys],
  )

  const tableRows = useMemo(
    () =>
      rawRows.map((r) => {
        const row: GreenTableRow = {}
        for (const k of orderedVisibleKeys) row[k] = cellValue(r[k], formatBoolean)
        return row
      }),
    [rawRows, orderedVisibleKeys, formatBoolean],
  )

  const rowPairs = useMemo(
    () => rawRows.map((raw, idx) => ({ raw: raw as GreenTableRawRow, display: tableRows[idx]! })),
    [rawRows, tableRows],
  )

  const columns = useMemo(() => {
    const showViewAssets = dualMode && !showGreenAssets
    const dataColumns = orderedVisibleKeys.map((colId) => ({
      id: colId as keyof GreenTableRow & string,
      label: t(`territory.panel.detail.meta.${colId}`, { defaultValue: colId }),
      isSortable: !NON_SORTABLE_DETAIL_COLUMNS.has(colId),
    }))
    if (onOpenDetail == null) return dataColumns

    return [
      ...dataColumns,
      {
        id: '__actions',
        label: '',
        isSortable: false as const,
        component: (_row: GreenTableRow, rowIndex: number) => {
          const pair = rowPairs[rowIndex]
          if (!pair) return null
          return (
            <GreenTableRowActions
              rawRow={pair.raw}
              onDetail={handleDetail}
              onViewAssets={showViewAssets ? handleViewAssets : undefined}
            />
          )
        },
      },
    ]
  }, [
    orderedVisibleKeys,
    rowPairs,
    dualMode,
    showGreenAssets,
    onOpenDetail,
    handleDetail,
    handleViewAssets,
    t,
  ])

  return {
    pickingColumns,
    setPickingColumns,
    orderedVisibleKeys,
    handleToggleColumn,
    tableRows,
    columns,
  }
}
