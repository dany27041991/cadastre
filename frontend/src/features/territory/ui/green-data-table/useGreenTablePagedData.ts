/**
 * Server-side pagination, sort, debounced filters and fetch for green tables.
 * Keeps rows visible while exact totals refresh (stale-while-revalidate).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  fetchGreenAssetsTablePaged,
  fetchGreenAreasTablePaged,
  type GreenTablePage,
} from '../../api/greenTable.api'

/** Debounce delay (ms) before a filter-text change triggers a fetch. */
const FILTER_DEBOUNCE_MS = 350

/**
 * Backoff for silent exact-total refetch while BE fills the wide COUNT cache.
 * Starts fast so the pager updates soon after the background count lands.
 */
const APPROX_RETRY_DELAYS_MS = [
  600, 800, 1200, 2000, 3000, 4000, 4000, 4000, 4000, 4000, 4000, 4000,
] as const

function isApproximateTotal(
  data: GreenTablePage,
  page: number,
  pageSize: number,
): boolean {
  const rowsN = data.data?.length ?? 0
  return rowsN === pageSize && data.total === (page - 1) * pageSize + rowsN + 1
}

export type UseGreenTablePagedDataArgs = {
  baseQuery: string | null
  showGreenAssets: boolean
  activeColumnFilters: Record<string, string>
  setTablePanelActive: (active: boolean) => void
}

export function useGreenTablePagedData({
  baseQuery,
  showGreenAssets,
  activeColumnFilters,
  setTablePanelActive,
}: UseGreenTablePagedDataArgs) {
  const [pageData, setPageData] = useState<GreenTablePage | null>(null)
  const [loading, setLoading] = useState(false)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(5)
  const [sort, setSort] = useState<[string, 'asc' | 'desc'] | null>(null)
  const [pageInput, setPageInput] = useState('1')
  const [exactTotalNonce, setExactTotalNonce] = useState(0)
  const [totalIsApproximate, setTotalIsApproximate] = useState(false)
  const approxRetriesRef = useRef(0)
  const pageDataRef = useRef(pageData)
  pageDataRef.current = pageData
  /** Last page/size successfully applied — SWR only for silent exact-total refresh. */
  const displayedPageRef = useRef<{ page: number; pageSize: number } | null>(null)

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

  const panelInitialized = useRef(false)

  const prevBaseQuery = useRef(baseQuery)
  useEffect(() => {
    if (prevBaseQuery.current === baseQuery) return
    prevBaseQuery.current = baseQuery
    setPage(1)
    setPageData(null)
    pageDataRef.current = null
    displayedPageRef.current = null
    panelInitialized.current = false
    approxRetriesRef.current = 0
    setExactTotalNonce(0)
    setTotalIsApproximate(false)
  }, [baseQuery])

  const debouncedFiltersKey = useMemo(
    () => JSON.stringify(debouncedFilters),
    [debouncedFilters],
  )
  const prevFilterKey = useRef(
    `${debouncedFiltersKey}|${String(sort)}|${String(showGreenAssets)}`,
  )
  const prevShowGreenAssets = useRef(showGreenAssets)
  useEffect(() => {
    const key = `${debouncedFiltersKey}|${String(sort)}|${String(showGreenAssets)}`
    if (prevFilterKey.current === key) return
    prevFilterKey.current = key
    setPage(1)
    if (prevShowGreenAssets.current !== showGreenAssets) {
      prevShowGreenAssets.current = showGreenAssets
      setPageData(null)
      pageDataRef.current = null
      displayedPageRef.current = null
      setTotalIsApproximate(false)
    }
  }, [debouncedFiltersKey, sort, showGreenAssets])

  useEffect(() => {
    setPageInput(String(page))
  }, [page])

  useEffect(() => {
    if (totalIsApproximate) return
    const tp = pageData?.total_pages
    if (tp == null || tp < 1) return
    setPage((p) => (p > tp ? tp : p))
  }, [pageData?.total_pages, pageData, totalIsApproximate])

  useEffect(() => {
    if (baseQuery == null) {
      setPageData(null)
      setTotalIsApproximate(false)
      return
    }

    let cancelled = false
    let approxTimer: ReturnType<typeof setTimeout> | null = null
    const abort = new AbortController()
    const displayed = displayedPageRef.current
    // Keep rows only for silent exact-total refresh (same page/size). Page jumps show loader.
    const keepRowsVisible =
      pageDataRef.current != null &&
      displayed != null &&
      displayed.page === page &&
      displayed.pageSize === pageSize
    if (!keepRowsVisible) setLoading(true)

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

    fetchFn(baseQuery, params, abort.signal)
      .then((data) => {
        if (cancelled) return
        const approx = isApproximateTotal(data, page, pageSize)
        setPageData(data)
        displayedPageRef.current = { page, pageSize }
        setTotalIsApproximate(approx)
        setLoading(false)
        if (!panelInitialized.current) {
          panelInitialized.current = true
          setTablePanelActive(data.total > 0)
        }
        if (approx && approxRetriesRef.current < APPROX_RETRY_DELAYS_MS.length) {
          const delay = APPROX_RETRY_DELAYS_MS[approxRetriesRef.current] ?? 4000
          approxRetriesRef.current += 1
          approxTimer = setTimeout(() => {
            setExactTotalNonce((n) => n + 1)
          }, delay)
        } else if (!approx) {
          approxRetriesRef.current = 0
        }
      })
      .catch((err) => {
        const aborted =
          cancelled ||
          (err instanceof DOMException && err.name === 'AbortError') ||
          (err instanceof Error && err.name === 'AbortError')
        if (aborted) return
        if (pageDataRef.current == null) {
          setPageData(null)
          setTotalIsApproximate(false)
        }
        setLoading(false)
      })

    return () => {
      cancelled = true
      abort.abort()
      if (approxTimer) clearTimeout(approxTimer)
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
    exactTotalNonce,
  ])

  const handleSort = useCallback((args: [string | number, 'asc' | 'desc'] | null) => {
    setSort(args ? [String(args[0]), args[1]] : null)
  }, [])

  const handlePaginationChange = useCallback((newPage: number, newPageSize: number) => {
    setPageSize(newPageSize)
    setPage(Math.max(1, newPage))
  }, [])

  const commitPageJump = useCallback(() => {
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
    // Approx has_more totals (e.g. "2") must not clamp jump — exact max is unknown yet.
    const max = totalIsApproximate
      ? Number.POSITIVE_INFINITY
      : Math.max(1, pageData?.total_pages ?? 1)
    const clamped = Math.min(max, Math.max(1, n))
    setPageInput(String(clamped))
    if (clamped !== page) setPage(clamped)
  }, [pageInput, page, pageData?.total_pages, totalIsApproximate])

  return {
    pageData,
    loading,
    page,
    pageSize,
    pageInput,
    setPageInput,
    total: pageData?.total ?? 0,
    totalPages: pageData?.total_pages ?? 1,
    totalIsApproximate,
    rawRows: pageData?.data ?? [],
    handleSort,
    handlePaginationChange,
    commitPageJump,
  }
}
