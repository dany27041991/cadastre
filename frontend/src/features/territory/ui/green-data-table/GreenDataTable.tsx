/**
 * Server-side paginated table for green areas and green assets.
 *
 * All filtering, sorting and pagination happen on the backend:
 *  - page / pageSize  → LIMIT / OFFSET
 *  - sort             → ORDER BY (whitelisted on server)
 *  - columnFilters    → per-catalog-key AND filters (ILIKE / exact)
 */
import './green-data-table.css'
import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { Box, Button, CustomTable, Text, icons } from 'dxc-webkit'
import { LoadingState } from '@/shared/ui'
import { useGreenTablePanel } from '../../context/GreenTablePanelContext'
import { GreenTableColumnPicker } from './GreenTableColumnPicker'
import type { GreenTableRawRow } from './GreenTableRowActions'
import { GreenTableDrillHeader } from './GreenTableDrillHeader'
import { GreenTablePageJump } from './GreenTablePageJump'
import { useGreenTableMode } from './useGreenTableMode'
import { useGreenTablePagedData } from './useGreenTablePagedData'
import { useGreenTableColumns } from './useGreenTableColumns'

export interface GreenDataTableProps {
  readonly areasActive: boolean
  readonly assetsActive: boolean
  /** Base territory query string (region_id, province_id, municipality_id, …) */
  readonly areasTableQuery: string | null
  readonly assetsTableQuery: string | null
  /** Open map detail for a table row (closes accordion via detail open effect). */
  readonly onOpenDetail?: (row: GreenTableRawRow, kind: 'area' | 'asset') => void
}

export function GreenDataTable({
  areasActive,
  assetsActive,
  areasTableQuery,
  assetsTableQuery,
  onOpenDetail,
}: GreenDataTableProps) {
  const { t } = useTranslation()
  const formatBoolean = useCallback(
    (b: boolean) => (b ? t('territory.table.booleanYes') : t('territory.table.booleanNo')),
    [t],
  )

  const { columnFiltersByKind, setActiveTableKind, setTablePanelActive } = useGreenTablePanel()

  const {
    dualMode,
    drillScope,
    showGreenAssets,
    tableKind,
    baseQuery,
    handleViewAssets,
    handleDetail,
    handleBackToAreas,
  } = useGreenTableMode({
    areasActive,
    assetsActive,
    areasTableQuery,
    assetsTableQuery,
    onOpenDetail,
    setActiveTableKind,
  })

  const activeColumnFilters = columnFiltersByKind[tableKind]

  const {
    pageData,
    loading,
    page,
    pageSize,
    pageInput,
    setPageInput,
    total,
    totalPages,
    rawRows,
    handleSort,
    handlePaginationChange,
    commitPageJump,
  } = useGreenTablePagedData({
    baseQuery,
    showGreenAssets,
    activeColumnFilters,
    setTablePanelActive,
  })

  const {
    pickingColumns,
    setPickingColumns,
    orderedVisibleKeys,
    handleToggleColumn,
    tableRows,
    columns,
  } = useGreenTableColumns({
    tableKind,
    dualMode,
    showGreenAssets,
    rawRows,
    formatBoolean,
    onOpenDetail,
    handleDetail,
    handleViewAssets,
  })

  const showDrillHeader = dualMode && drillScope != null
  const drillHeader = showDrillHeader ? (
    <GreenTableDrillHeader areaLabel={drillScope?.label} onBack={handleBackToAreas} />
  ) : null

  const tableLoader = (
    <Box as="div" className="green-data-table-body__loader">
      <LoadingState size="l" label={t('territory.loading')} />
    </Box>
  )

  const columnsSettingsButton = (
    <Button
      kind="bare"
      color="primary"
      size="sm"
      icon
      onClick={() => setPickingColumns(true)}
      aria-label={t('territory.table.columnsToggle')}
    >
      <icons.SettingsIcon />
    </Button>
  )

  if (baseQuery == null) return null

  if (pickingColumns) {
    return (
      <Box as="div" className="green-data-table" style={{ width: '100%' }}>
        <GreenTableColumnPicker
          kind={tableKind}
          selectedKeys={orderedVisibleKeys}
          onToggle={handleToggleColumn}
          onBack={() => setPickingColumns(false)}
        />
      </Box>
    )
  }

  if (loading && !pageData) {
    return (
      <Box as="div" className="green-data-table" padding="m" style={{ width: '100%' }}>
        {drillHeader}
        <Box as="div" className="green-data-table-body" style={{ minHeight: '10rem' }}>
          {tableLoader}
        </Box>
      </Box>
    )
  }

  if (!loading && total === 0) {
    return (
      <Box as="div" className="green-data-table" padding="m" style={{ width: '100%' }}>
        {drillHeader}
        <Text font="f1-body-sm" style={{ color: 'var(--gray-600, #6c757d)' }}>
          {t('territory.panel.noDataInPeriod')}
        </Text>
      </Box>
    )
  }

  return (
    <Box
      as="div"
      className="green-data-table green-data-table-layout"
      style={{
        width: '100%',
        minWidth: 0,
        maxWidth: '100%',
      }}
    >
      {drillHeader}
      <Box as="div" className="green-data-table-body">
        {loading ? tableLoader : null}
        <Box
          as="div"
          className={
            loading
              ? 'green-data-table-body__content green-data-table-body__content--dimmed'
              : 'green-data-table-body__content'
          }
        >
          <Box as="div" className="green-data-table-top-bar compact-table">
            <Box as="div" className="green-data-table-top-bar__start">
              {columnsSettingsButton}
            </Box>
            <Box as="div" className="green-data-table-top-bar__end">
              <GreenTablePageJump
                page={page}
                totalPages={totalPages}
                pageInput={pageInput}
                loading={loading}
                onPageInputChange={setPageInput}
                onCommit={commitPageJump}
              />
            </Box>
          </Box>
          <CustomTable
            color="primary-alternate"
            style={{ margin: 0 }}
            className="table-sm"
            wrapperClassName="compact-table green-data-table-fixed-columns"
            tableWrapperClassname="scrollable-container compact-table green-data-table-fixed-columns"
            headerCellClassName="f1-label-sm"
            cellClassName="f1-body-sm"
            columns={columns}
            rows={tableRows}
            handleSort={handleSort}
            pagination
            paginationOptions={[Math.min(page, totalPages), pageSize, total]}
            handlePaginationChange={handlePaginationChange}
            pageSizeOptions={[5, 10, 15, 25, 50]}
            actions={[]}
            renderDistance={1}
            openTop
            hideGoToDropdown
          />
        </Box>
      </Box>
    </Box>
  )
}
