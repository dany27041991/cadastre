/**
 * Server-side paginated table for green areas and green assets.
 *
 * All filtering, sorting and pagination happen on the backend:
 *  - page / pageSize  → LIMIT / OFFSET
 *  - sort             → ORDER BY (whitelisted on server)
 *  - columnFilters    → per-catalog-key AND filters (ILIKE / exact)
 */
import './green-data-table.css'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Box, Button, CustomTable, Text, icons } from 'dxc-webkit'
import { BackNavHeader, LoadingState } from '@/shared/ui'
import { useGreenTablePanel } from '../../context/GreenTablePanelContext'
import {
  NON_SORTABLE_DETAIL_COLUMNS,
  type GreenTableKind,
} from '../../lib/greenDetailColumnCatalog'
import {
  loadVisibleColumns,
  orderVisibleKeys,
  toggleVisibleColumn,
} from '../../lib/greenTableVisibleCols'
import { GreenTableColumnPicker } from './GreenTableColumnPicker'
import { GreenTableRowActions, type GreenTableRawRow } from './GreenTableRowActions'
import {
  fetchGreenAssetsTablePaged,
  fetchGreenAreasTablePaged,
  type GreenTablePage,
} from '../../api/greenTable.api'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type GreenTableRow = Record<string, string | number>

/** Debounce delay (ms) before a filter-text change triggers a fetch. */
const FILTER_DEBOUNCE_MS = 350

// ---------------------------------------------------------------------------
// Pure helpers — no React deps, safe to call in useMemo
// ---------------------------------------------------------------------------

const FORMAT_MAX_DEPTH = 5

function isPlainScalar(v: unknown): boolean {
  return v == null || typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean'
}

function scalarToString(v: unknown, formatBoolean: (b: boolean) => string): string {
  if (v == null) return '—'
  if (typeof v === 'string') return v
  if (typeof v === 'number') return String(v)
  if (typeof v === 'boolean') return formatBoolean(v)
  return '—'
}

function formatComplexValue(
  v: unknown,
  formatBoolean: (b: boolean) => string,
  depth = 0,
): string {
  if (depth > FORMAT_MAX_DEPTH) return '…'
  if (isPlainScalar(v)) return scalarToString(v, formatBoolean)

  if (Array.isArray(v)) {
    if (v.length === 0) return '—'
    if (v.every(isPlainScalar)) return v.map((x) => scalarToString(x, formatBoolean)).join(', ')
    return v
      .map((item, i) => {
        const inner = formatComplexValue(item, formatBoolean, depth + 1)
        return inner.includes('\n')
          ? `${i + 1}. ${inner.replace(/\n/g, '\n  ')}`
          : `${i + 1}. ${inner}`
      })
      .join('\n')
  }

  if (typeof v === 'object' && v !== null) {
    const o = v as Record<string, unknown>
    const keys = Object.keys(o)
    if (keys.length === 0) return '{}'
    return keys
      .map((k) => {
        const inner = formatComplexValue(o[k], formatBoolean, depth + 1)
        return inner.includes('\n')
          ? `${k}:\n  ${inner.replace(/\n/g, '\n  ')}`
          : `${k}: ${inner}`
      })
      .join('\n')
  }

  try {
    return JSON.stringify(v)
  } catch {
    return String(v)
  }
}

function cellValue(v: unknown, formatBoolean: (b: boolean) => string): string | number {
  if (v == null) return 'NaN'
  if (typeof v === 'number' || typeof v === 'string') return v === '' ? 'NaN' : v
  if (typeof v === 'boolean') return formatBoolean(v)
  return formatComplexValue(v, formatBoolean, 0)
}

function greenAreaIdFromRow(row: GreenTableRawRow): number | null {
  const raw = row.id
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw
  if (typeof raw === 'string' && raw.trim() !== '') {
    const n = Number(raw)
    return Number.isFinite(n) ? n : null
  }
  return null
}

function withGreenAreaId(territoryQuery: string, greenAreaId: number): string {
  const p = new URLSearchParams(territoryQuery)
  p.set('green_area_id', String(greenAreaId))
  return p.toString()
}

function areaLabelFromRow(row: GreenTableRawRow): string | null {
  const name = row.name
  if (typeof name === 'string' && name.trim() !== '') return name.trim()
  const label = row.green_area_label
  if (typeof label === 'string' && label.trim() !== '') return label.trim()
  return null
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface GreenDataTableProps {
  readonly areasActive: boolean
  readonly assetsActive: boolean
  /** Base territory query string (region_id, province_id, municipality_id, …) */
  readonly areasTableQuery: string | null
  readonly assetsTableQuery: string | null
  /** Open map detail for a table row (closes accordion via detail open effect). */
  readonly onOpenDetail?: (row: GreenTableRawRow, kind: 'area' | 'asset') => void
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

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

  const {
    columnFiltersByKind,
    setActiveTableKind,
    setTablePanelActive,
  } = useGreenTablePanel()

  const dualMode = areasActive && assetsActive
  const [drillAreaId, setDrillAreaId] = useState<number | null>(null)
  const [drillAreaLabel, setDrillAreaLabel] = useState<string | null>(null)
  const [pickingColumns, setPickingColumns] = useState(false)

  useEffect(() => {
    if (!dualMode) {
      setDrillAreaId(null)
      setDrillAreaLabel(null)
    }
  }, [dualMode])

  // Search / map drill already scopes breadcrumb to a green area: align dual-mode
  // assets drill so the assets table uses the same green_area_id without a row click.
  useEffect(() => {
    if (!dualMode || assetsTableQuery == null) return
    const fromNav = Number(new URLSearchParams(assetsTableQuery).get('green_area_id'))
    if (!Number.isFinite(fromNav) || fromNav <= 0) {
      setDrillAreaId(null)
      setDrillAreaLabel(null)
      return
    }
    setDrillAreaId(fromNav)
  }, [dualMode, assetsTableQuery])

  // Assets-only, or dual mode after drilling into an area.
  const showGreenAssets =
    (assetsActive && !areasActive) || (dualMode && drillAreaId != null)

  const tableKind: GreenTableKind = showGreenAssets ? 'asset' : 'area'

  useEffect(() => {
    setActiveTableKind(tableKind)
  }, [tableKind, setActiveTableKind])

  const activeColumnFilters = columnFiltersByKind[tableKind]

  const [visibleKeys, setVisibleKeys] = useState<string[]>(() =>
    loadVisibleColumns('area')
  )

  useEffect(() => {
    setVisibleKeys(loadVisibleColumns(tableKind))
    setPickingColumns(false)
  }, [tableKind])

  const baseQuery = useMemo(() => {
    if (showGreenAssets) {
      if (assetsTableQuery == null) return null
      if (drillAreaId != null) return withGreenAreaId(assetsTableQuery, drillAreaId)
      return assetsTableQuery
    }
    return areasTableQuery
  }, [showGreenAssets, assetsTableQuery, areasTableQuery, drillAreaId])

  const handleViewAssets = useCallback((row: GreenTableRawRow) => {
    const id = greenAreaIdFromRow(row)
    if (id == null) return
    setDrillAreaId(id)
    setDrillAreaLabel(areaLabelFromRow(row))
  }, [])

  const handleDetail = useCallback(
    (row: GreenTableRawRow) => {
      onOpenDetail?.(row, showGreenAssets ? 'asset' : 'area')
    },
    [onOpenDetail, showGreenAssets],
  )

  const handleBackToAreas = useCallback(() => {
    setDrillAreaId(null)
    setDrillAreaLabel(null)
  }, [])

  // Server-side pagination / sort state.
  const [pageData, setPageData] = useState<GreenTablePage | null>(null)
  const [loading, setLoading] = useState(false)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(5)
  const [sort, setSort] = useState<[string, 'asc' | 'desc'] | null>(null)
  /** Local value for "go to page" input (CustomTable has no native number field for this). */
  const [pageInput, setPageInput] = useState('1')

  // Debounced multi-field filters: avoids a fetch on every keystroke.
  const [debouncedFilters, setDebouncedFilters] = useState<Record<string, string>>(
    () => ({ ...activeColumnFilters }),
  )
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const filtersSerialized = useMemo(
    () => JSON.stringify(activeColumnFilters),
    [activeColumnFilters],
  )
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      setDebouncedFilters(JSON.parse(filtersSerialized) as Record<string, string>)
    }, FILTER_DEBOUNCE_MS)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [filtersSerialized])

  // Track whether panel callbacks have been fired for the current territory scope
  // so we don't dispatch redundant state updates on every page change.
  const panelInitialized = useRef(false)

  // Reset everything when the territory scope changes (different comune, tab switch, etc.).
  // Merging all resets into one effect avoids the double-fetch that two separate effects cause:
  // a single effect batches setPage(1) + setPageData(null) in the same render cycle.
  const prevBaseQuery = useRef(baseQuery)
  useEffect(() => {
    if (prevBaseQuery.current === baseQuery) return
    prevBaseQuery.current = baseQuery
    setPage(1)
    setPageData(null)
    panelInitialized.current = false
  }, [baseQuery])

  // Reset page to 1 when filter / sort / dataset changes.
  // This is intentionally separate from the baseQuery reset because we want
  // to keep pageData visible (stale-while-revalidate UX) while re-fetching.
  const debouncedFiltersKey = useMemo(
    () => JSON.stringify(debouncedFilters),
    [debouncedFilters],
  )
  const prevFilterKey = useRef(
    `${debouncedFiltersKey}|${String(sort)}|${String(showGreenAssets)}`,
  )
  useEffect(() => {
    const key = `${debouncedFiltersKey}|${String(sort)}|${String(showGreenAssets)}`
    if (prevFilterKey.current === key) return
    prevFilterKey.current = key
    setPage(1)
  }, [debouncedFiltersKey, sort, showGreenAssets])

  // Keep the page input in sync when the current page changes (e.g. pager clicks).
  useEffect(() => {
    setPageInput(String(page))
  }, [page])

  // If filters reduce total_pages below the current page, clamp to the last page.
  useEffect(() => {
    const tp = pageData?.total_pages
    if (tp == null || tp < 1) return
    setPage((p) => (p > tp ? tp : p))
  }, [pageData?.total_pages, pageData])

  // Core fetch effect — runs when any fetch-relevant param changes.
  // baseQuery may be an empty string (nationwide scope): still a valid query.
  useEffect(() => {
    if (baseQuery == null) {
      setPageData(null)
      return
    }

    let cancelled = false
    setLoading(true)

    const params: Record<string, string | number> = { page, page_size: pageSize }
    if (sort) {
      params['sort_by'] = sort[0]
      params['sort_dir'] = sort[1]
    }
    if (debouncedFiltersKey !== '{}') {
      for (const [k, v] of Object.entries(debouncedFilters)) {
        if (v) params[k] = v
      }
    }

    const fetchFn = showGreenAssets ? fetchGreenAssetsTablePaged : fetchGreenAreasTablePaged

    fetchFn(baseQuery, params)
      .then((data) => {
        if (cancelled) return
        setPageData(data)
        setLoading(false)
        // Fire panel callbacks only once per territory scope to avoid redundant
        // state updates on every page/sort/filter change.
        if (!panelInitialized.current) {
          panelInitialized.current = true
          setTablePanelActive(data.total > 0)
        }
      })
      .catch(() => {
        if (cancelled) return
        setPageData(null)
        setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [
    baseQuery,
    showGreenAssets,
    page,
    pageSize,
    sort,
    debouncedFilters,
    debouncedFiltersKey,
    setTablePanelActive,
  ])

  // Derive column metadata from the curated catalog (not from sparse page keys).
  const rawRows = pageData?.data ?? []

  const handleToggleColumn = useCallback(
    (key: string) => {
      setVisibleKeys((prev) => toggleVisibleColumn(tableKind, prev, key))
    },
    [tableKind]
  )

  const orderedVisibleKeys = useMemo(
    () => orderVisibleKeys(tableKind, visibleKeys),
    [tableKind, visibleKeys]
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
    () => rawRows.map((raw, idx) => ({ raw, display: tableRows[idx]! })),
    [rawRows, tableRows],
  )

  const columns = useMemo(() => {
    // ⋯ always: Dettaglio; + "Assets verdi" on dual-mode areas rows.
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

  const handleSort = useCallback((args: [string | number, 'asc' | 'desc'] | null) => {
    setSort(args ? [String(args[0]), args[1]] : null)
  }, [])

  const handlePaginationChange = useCallback((newPage: number, newPageSize: number) => {
    setPageSize(newPageSize)
    setPage(Math.max(1, newPage))
  }, [])

  const commitPageJump = useCallback(() => {
    const max = Math.max(1, pageData?.total_pages ?? 1)
    const raw = pageInput.trim()
    if (raw === '') {
      setPageInput(String(page))
      return
    }
    const n = Number.parseInt(raw, 10)
    if (!Number.isFinite(n)) {
      setPageInput(String(page))
      return
    }
    const clamped = Math.min(max, Math.max(1, n))
    setPageInput(String(clamped))
    if (clamped !== page) setPage(clamped)
  }, [pageInput, page, pageData?.total_pages])

  const total = pageData?.total ?? 0
  const totalPages = pageData?.total_pages ?? 1

  const showDrillHeader = dualMode && drillAreaId != null

  const drillHeader = showDrillHeader ? (
    <BackNavHeader
      backLabel={t('territory.table.backToAreas')}
      onBack={handleBackToAreas}
      titleLabel={t('territory.table.managedAreaNameLabel')}
      title={drillAreaLabel}
      hint={t('territory.table.drillAreaAssetsHint')}
    />
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

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  // Empty string is a valid nationwide query (all territory filters omitted).
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
          {t('territory.table.emptyRows')}
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
              {totalPages > 1 ? (
                <Box as="div" className="green-data-table-page-jump green-data-table-page-jump--top">
                  <label
                    className="green-data-table-page-jump-label"
                    htmlFor="green-table-page-jump"
                  >
                    <Text as="span" font="f1-body-sm">
                      {t('territory.table.goToPageLabel')}
                    </Text>
                  </label>
                  <input
                    id="green-table-page-jump"
                    type="number"
                    className="green-data-table-page-jump-input"
                    min={1}
                    max={totalPages}
                    value={pageInput}
                    disabled={loading}
                    aria-label={t('territory.table.goToPageAria', { max: totalPages })}
                    onChange={(e) => setPageInput(e.target.value)}
                    onBlur={commitPageJump}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        commitPageJump()
                      }
                    }}
                  />
                  <Text as="span" font="f1-body-sm" className="green-data-table-page-jump-suffix">
                    {t('territory.table.goToPageOf', { total: totalPages })}
                  </Text>
                </Box>
              ) : null}
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
