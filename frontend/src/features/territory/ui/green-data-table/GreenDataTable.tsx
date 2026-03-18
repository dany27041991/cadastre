/**
 * Single table for green areas and green assets: five base columns plus optional extra columns.
 */
import './green-data-table.css'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Box, CustomTable } from 'dxc-webkit'
import { useGreenTablePanel } from '../../context/GreenTablePanelContext'
import { labelizeGreenColumn } from '../../lib/greenTableColumnLabel'
import {
  GreenTableRowActions,
  type GreenTableRawRow,
} from './GreenTableRowActions'

type GreenTableRow = Record<string, string | number>

const AREA_COLUMN_PRIORITY = [
  'id',
  'name',
  'level',
  'municipality_id',
  'geometry_type',
  'region_id',
  'province_id',
  'parent_id',
  'operational_status',
  'administrative_status',
]

const ASSET_COLUMN_PRIORITY = [
  'id',
  'asset_type',
  'geometry_type',
  'species',
  'family',
  'genus',
  'green_area_id',
  'municipality_id',
  'health_status',
]

function collectKeys(rows: Record<string, unknown>[]): string[] {
  const s = new Set<string>()
  for (const r of rows) {
    Object.keys(r).forEach((k) => s.add(k))
  }
  return [...s].sort()
}

function pickDefaultFive(allKeys: string[], priority: string[]): string[] {
  const out: string[] = []
  for (const k of priority) {
    if (allKeys.includes(k) && !out.includes(k)) out.push(k)
    if (out.length >= 5) return out
  }
  for (const k of allKeys) {
    if (!out.includes(k)) out.push(k)
    if (out.length >= 5) return out
  }
  return out
}

const FORMAT_MAX_DEPTH = 5

function isPlainScalar(v: unknown): boolean {
  return (
    v == null ||
    typeof v === 'string' ||
    typeof v === 'number' ||
    typeof v === 'boolean'
  )
}

function scalarToString(
  v: unknown,
  formatBoolean: (b: boolean) => string
): string {
  if (v == null) return '—'
  if (typeof v === 'string') return v
  if (typeof v === 'number') return String(v)
  if (typeof v === 'boolean') return formatBoolean(v)
  return '—'
}

/** Formats arrays and objects for table cells (multi-line); avoids raw JSON blobs. */
function formatComplexValue(
  v: unknown,
  formatBoolean: (b: boolean) => string,
  depth = 0
): string {
  if (depth > FORMAT_MAX_DEPTH) return '…'
  if (isPlainScalar(v)) return scalarToString(v, formatBoolean)

  if (Array.isArray(v)) {
    if (v.length === 0) return '—'
    if (v.every(isPlainScalar)) {
      return v.map((x) => scalarToString(x, formatBoolean)).join(', ')
    }
    return v
      .map((item, i) => {
        const inner = formatComplexValue(item, formatBoolean, depth + 1)
        const indent = '  '
        return inner.includes('\n')
          ? `${i + 1}. ${inner.replace(/\n/g, `\n${indent}`)}`
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
        const val = o[k]
        const inner = formatComplexValue(val, formatBoolean, depth + 1)
        const indent = '  '
        return inner.includes('\n')
          ? `${k}:\n${indent}${inner.replace(/\n/g, `\n${indent}`)}`
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

function cellValue(
  v: unknown,
  formatBoolean: (b: boolean) => string
): string | number {
  if (v == null) return '—'
  if (typeof v === 'number' || typeof v === 'string') return v
  if (typeof v === 'boolean') return formatBoolean(v)
  return formatComplexValue(v, formatBoolean, 0)
}

export interface GreenDataTableProps {
  /** false = green areas, true = green assets (trees toggle) */
  readonly showGreenAssets: boolean
  readonly areasTableQuery: string | null
  readonly assetsTableQuery: string | null
  /** Row action callbacks (raw API row data) */
  readonly onRowDetail?: (row: GreenTableRawRow) => void
  readonly onRowEdit?: (row: GreenTableRawRow) => void
  readonly onRowRemove?: (row: GreenTableRawRow) => void
}

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
    [t]
  )
  const {
    extraColumns,
    filterText,
    filterColumnKey,
    registerTableColumns,
    greenTableRows,
  } = useGreenTablePanel()

  const rawRows = greenTableRows
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(5)
  const [sort, setSort] = useState<[string, 'asc' | 'desc'] | null>(null)

  const fetchKey = showGreenAssets ? assetsTableQuery : areasTableQuery

  useEffect(() => {
    if (!fetchKey) return
    setPage(1)
  }, [fetchKey, showGreenAssets])

  const allKeys = useMemo(() => collectKeys(rawRows), [rawRows])
  const defaultFive = useMemo(
    () =>
      pickDefaultFive(
        allKeys,
        showGreenAssets ? ASSET_COLUMN_PRIORITY : AREA_COLUMN_PRIORITY
      ),
    [allKeys, showGreenAssets]
  )

  useEffect(() => {
    if (!fetchKey) return
    registerTableColumns(allKeys, defaultFive)
  }, [fetchKey, allKeys, defaultFive, registerTableColumns])

  const filteredRawRows = useMemo(() => {
    const q = filterText.trim().toLowerCase()
    if (!q) return rawRows
    return rawRows.filter((row) => {
      if (filterColumnKey) {
        return String(row[filterColumnKey] ?? '')
          .toLowerCase()
          .includes(q)
      }
      return Object.values(row).some((v) =>
        String(v ?? '')
          .toLowerCase()
          .includes(q)
      )
    })
  }, [rawRows, filterText, filterColumnKey])

  const visibleKeys = useMemo(() => {
    const base = new Set(defaultFive)
    const ordered = [...defaultFive]
    for (const k of extraColumns) {
      if (allKeys.includes(k) && !base.has(k)) {
        base.add(k)
        ordered.push(k)
      }
    }
    return ordered
  }, [defaultFive, extraColumns, allKeys])

  const tableRows = useMemo(() => {
    return filteredRawRows.map((r) => {
      const row: GreenTableRow = {}
      for (const k of visibleKeys) {
        row[k] = cellValue(r[k], formatBoolean)
      }
      return row
    })
  }, [filteredRawRows, visibleKeys, formatBoolean])

  const rowPairs = useMemo(
    () =>
      filteredRawRows.map((raw, idx) => ({
        raw,
        display: tableRows[idx]!,
      })),
    [filteredRawRows, tableRows]
  )

  const sortedPairs = useMemo(() => {
    if (!sort) return rowPairs
    const [field, dir] = sort
    const copy = [...rowPairs]
    copy.sort((a, b) => {
      const cmp = String(a.display[field] ?? '').localeCompare(
        String(b.display[field] ?? ''),
        undefined,
        {
          numeric: true,
          sensitivity: 'base',
        }
      )
      return dir === 'asc' ? cmp : -cmp
    })
    return copy
  }, [rowPairs, sort])

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(sortedPairs.length / pageSize)),
    [sortedPairs.length, pageSize]
  )

  /** When page > totalPages (e.g. after increasing page size), reset to last valid page. */
  useEffect(() => {
    if (sortedPairs.length === 0) return
    if (page > totalPages) {
      setPage(totalPages)
    }
  }, [sortedPairs.length, pageSize, page, totalPages])

  const paginatedPairs = useMemo(() => {
    const safePage = Math.min(page, totalPages)
    const start = (safePage - 1) * pageSize
    return sortedPairs.slice(start, start + pageSize)
  }, [sortedPairs, page, pageSize, totalPages])

  const paginatedRows = useMemo(
    () => paginatedPairs.map((p) => p.display),
    [paginatedPairs]
  )

  const columns = useMemo(() => {
    const menuColumn = {
      id: '__actions',
      label: '',
      isSortable: false as const,
      component: (_row: GreenTableRow, rowIndex: number) => {
        const pair = paginatedPairs[rowIndex]
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
  }, [
    visibleKeys,
    paginatedPairs,
    onRowDetail,
    onRowEdit,
    onRowRemove,
  ])

  const handleSort = useCallback((args: [string | number, 'asc' | 'desc'] | null) => {
    setSort(args ? [String(args[0]), args[1]] : null)
    setPage(1)
  }, [])

  const handlePaginationChange = useCallback(
    (newPage: number, newPageSize: number) => {
      setPageSize(newPageSize)
      const pages = Math.max(1, Math.ceil(sortedPairs.length / newPageSize))
      const safePage = Math.min(Math.max(1, newPage), pages)
      setPage(safePage)
    },
    [sortedPairs.length]
  )

  if (!fetchKey || rawRows.length === 0) {
    return null
  }

  return (
    <Box
      as="div"
      className="green-data-table"
      style={{ width: '100%', minWidth: 0, maxWidth: '100%' }}
    >
      <CustomTable
        color="primary-alternate"
        style={{ margin: 0 }}
        className="table-sm"
        wrapperClassName="compact-table green-data-table-fixed-columns"
        tableWrapperClassname="scrollable-container compact-table green-data-table-fixed-columns"
        headerCellClassName="f1-label-sm"
        cellClassName="f1-body-sm"
        columns={columns}
        rows={paginatedRows}
        handleSort={handleSort}
        pagination
        hideGoToDropdown
        paginationOptions={[Math.min(page, totalPages), pageSize, sortedPairs.length]}
        handlePaginationChange={handlePaginationChange}
        pageSizeOptions={[5, 10, 15, 25, 50]}
        actions={[]}
        renderDistance={1}
        openTop
      />
    </Box>
  )
}
