/**
 * Server-side paginated table for green areas and green assets.
 *
 * All filtering, sorting and pagination happen on the backend:
 *  - page / pageSize  → LIMIT / OFFSET
 *  - sort             → ORDER BY (whitelisted on server)
 *  - filterText       → column ILIKE or q free-text search
 */
import './green-data-table.css'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Box, CustomTable, Text } from 'dxc-webkit'
import { useGreenTablePanel } from '../../context/GreenTablePanelContext'
import { labelizeGreenColumn } from '../../lib/greenTableColumnLabel'
import { filterGreenTableNonIdKeys } from '../../lib/greenTableColumnVisibility'
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

const AREA_COLUMN_PRIORITY = [
  'name',
  'level',
  'geometry_type',
  'municipality_label',
  'region_label',
  'province_label',
  'level_id_label',
  'parent_label',
  'attribute_type_label',
  'operational_status',
  'administrative_status',
]

const ASSET_COLUMN_PRIORITY = [
  'asset_type',
  'geometry_type',
  'species',
  'family',
  'genus',
  'green_area_label',
  'municipality_label',
  'region_label',
  'province_label',
  'attribute_type_label',
  'health_status',
]

/** Debounce delay (ms) before a filter-text change triggers a fetch. */
const FILTER_DEBOUNCE_MS = 350

// ---------------------------------------------------------------------------
// Pure helpers — no React deps, safe to call in useMemo
// ---------------------------------------------------------------------------

function collectKeys(rows: Record<string, unknown>[]): string[] {
  const seen = new Set<string>()
  for (const r of rows) {
    for (const k of Object.keys(r)) seen.add(k)
  }
  return [...seen].sort()
}

function pickDefaultFive(allKeys: string[], priority: string[]): string[] {
  const allSet = new Set(allKeys)
  const out: string[] = []
  const outSet = new Set<string>()
  for (const k of priority) {
    if (allSet.has(k) && !outSet.has(k)) {
      out.push(k)
      outSet.add(k)
    }
    if (out.length >= 5) return out
  }
  for (const k of allKeys) {
    if (!outSet.has(k)) {
      out.push(k)
      outSet.add(k)
    }
    if (out.length >= 5) return out
  }
  return out
}

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
  if (v == null) return '—'
  if (typeof v === 'number' || typeof v === 'string') return v
  if (typeof v === 'boolean') return formatBoolean(v)
  return formatComplexValue(v, formatBoolean, 0)
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface GreenDataTableProps {
  /** false = green areas, true = green assets (trees toggle) */
  readonly showGreenAssets: boolean
  /** Base territory query string (region_id, province_id, municipality_id, …) */
  readonly areasTableQuery: string | null
  readonly assetsTableQuery: string | null
  readonly onRowDetail?: (row: GreenTableRawRow) => void
  readonly onRowEdit?: (row: GreenTableRawRow) => void
  readonly onRowRemove?: (row: GreenTableRawRow) => void
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function GreenDataTable({
  showGreenAssets,
  areasTableQuery,
  assetsTableQuery,
  onRowDetail,
  onRowEdit,
  onRowRemove,
}: GreenDataTableProps) {
  const { t } = useTranslation()
  const formatBoolean = useCallback(
    (b: boolean) => (b ? t('territory.table.booleanYes') : t('territory.table.booleanNo')),
    [t],
  )

  const {
    extraColumns,
    filterText,
    filterColumnKey,
    registerTableColumns,
    setTablePanelActive,
    setMapTableAccordionVisible,
  } = useGreenTablePanel()

  const baseQuery = showGreenAssets ? assetsTableQuery : areasTableQuery

  // Server-side pagination / sort state.
  const [pageData, setPageData] = useState<GreenTablePage | null>(null)
  const [loading, setLoading] = useState(false)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(5)
  const [sort, setSort] = useState<[string, 'asc' | 'desc'] | null>(null)
  /** Local value for "go to page" input (CustomTable has no native number field for this). */
  const [pageInput, setPageInput] = useState('1')

  // Debounced filter: avoids a fetch on every keystroke.
  const [debouncedFilter, setDebouncedFilter] = useState(filterText)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => setDebouncedFilter(filterText), FILTER_DEBOUNCE_MS)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [filterText])

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
  const prevFilterKey = useRef(`${debouncedFilter}|${filterColumnKey}|${String(sort)}|${String(showGreenAssets)}`)
  useEffect(() => {
    const key = `${debouncedFilter}|${filterColumnKey}|${String(sort)}|${String(showGreenAssets)}`
    if (prevFilterKey.current === key) return
    prevFilterKey.current = key
    setPage(1)
  }, [debouncedFilter, filterColumnKey, sort, showGreenAssets])

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
  useEffect(() => {
    if (!baseQuery) {
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
    if (debouncedFilter) {
      // Use column-specific filter when a column is selected; fall back to full-text q.
      params[filterColumnKey || 'q'] = debouncedFilter
    }

    const fetchFn = showGreenAssets ? fetchGreenAssetsTablePaged : fetchGreenAreasTablePaged

    fetchFn(baseQuery, params)
      .then((data) => {
        if (cancelled) return
        setPageData(data)
        setLoading(false)
        // Fire panel callbacks only once per territory scope to avoid redundant
        // state updates on every page/sort/filter change.
        if (data.total > 0 && !panelInitialized.current) {
          panelInitialized.current = true
          setTablePanelActive(true)
          setMapTableAccordionVisible(true)
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
    debouncedFilter,
    filterColumnKey,
    setTablePanelActive,
    setMapTableAccordionVisible,
  ])

  // Derive column metadata from the current page.
  const rawRows = pageData?.data ?? []

  const allKeys = useMemo(() => filterGreenTableNonIdKeys(collectKeys(rawRows)), [rawRows])

  const defaultFive = useMemo(
    () => pickDefaultFive(allKeys, showGreenAssets ? ASSET_COLUMN_PRIORITY : AREA_COLUMN_PRIORITY),
    [allKeys, showGreenAssets],
  )

  useEffect(() => {
    if (!baseQuery || rawRows.length === 0) return
    registerTableColumns(allKeys, defaultFive)
  }, [baseQuery, allKeys, defaultFive, registerTableColumns, rawRows.length])

  const visibleKeys = useMemo(() => {
    const allKeysSet = new Set(allKeys)
    const seen = new Set(defaultFive)
    const ordered = [...defaultFive]
    for (const k of extraColumns) {
      if (allKeysSet.has(k) && !seen.has(k)) {
        seen.add(k)
        ordered.push(k)
      }
    }
    return ordered
  }, [defaultFive, extraColumns, allKeys])

  const tableRows = useMemo(
    () =>
      rawRows.map((r) => {
        const row: GreenTableRow = {}
        for (const k of visibleKeys) row[k] = cellValue(r[k], formatBoolean)
        return row
      }),
    [rawRows, visibleKeys, formatBoolean],
  )

  const rowPairs = useMemo(
    () => rawRows.map((raw, idx) => ({ raw, display: tableRows[idx]! })),
    [rawRows, tableRows],
  )

  const columns = useMemo(() => {
    const menuColumn = {
      id: '__actions',
      label: '',
      isSortable: false as const,
      component: (_row: GreenTableRow, rowIndex: number) => {
        const pair = rowPairs[rowIndex]
        if (!pair) return null
        return (
          <GreenTableRowActions
            rawRow={pair.raw}
            onDetail={onRowDetail}
            onEdit={onRowEdit}
            onRemove={onRowRemove}
          />
        )
      },
    }
    return [
      ...visibleKeys.map((colId) => ({
        id: colId as keyof GreenTableRow & string,
        label: labelizeGreenColumn(colId),
        isSortable: true,
      })),
      menuColumn,
    ]
  }, [visibleKeys, rowPairs, onRowDetail, onRowEdit, onRowRemove])

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

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  if (!baseQuery) return null

  if (loading && !pageData) {
    return (
      <Box as="div" className="green-data-table" padding="m" style={{ width: '100%' }}>
        <Text font="f1-body-sm" style={{ color: 'var(--gray-600, #6c757d)' }}>
          {t('territory.table.loading', 'Caricamento dati...')}
        </Text>
      </Box>
    )
  }

  if (!loading && total === 0) {
    return (
      <Box as="div" className="green-data-table" padding="m" style={{ width: '100%' }}>
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
        // Dim the table while refetching pages/sort/filter without hiding stale data.
        opacity: loading ? 0.55 : 1,
        pointerEvents: loading ? 'none' : undefined,
        transition: 'opacity 0.15s ease',
      }}
    >
      {totalPages > 1 ? (
        <Box
          as="div"
          className="green-data-table-page-jump green-data-table-page-jump--top compact-table"
          style={{ width: '100%' }}
        >
          <label className="green-data-table-page-jump-label" htmlFor="green-table-page-jump">
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
  )
}
