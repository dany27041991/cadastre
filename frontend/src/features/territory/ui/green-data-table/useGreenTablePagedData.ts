/**
 * Server-side pagination, sort, applied filters and fetch for green tables.
 * Keeps rows visible while exact totals refresh (stale-while-revalidate).
 * Filters come from applied (Cerca commit), not draft — no live debounce.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  fetchGreenAssetsTablePaged,
  fetchGreenAreasTablePaged,
  type GreenTablePage,
} from '../../api/greenTable.api'
import { FILTER_SCOPE_DENYLIST } from '../../lib/appendAppliedFilters'
import {
  isTableFetchBlocked,
  isViewportLoadBurstActive,
} from '../../model/hooks/viewportLoadGate'
/**
 * Backoff for silent exact-total refetch while BE fills the wide COUNT cache.
 * Starts fast so the pager updates soon after the background count lands.
 */
// Softer exact-total polls (Fase 2): fewer DuckDB hits while viewport settles.
// Burst still floors delay at 15s (was 10s) — debug 4fe799 pool contention.
const APPROX_RETRY_DELAYS_MS = [5000, 12000] as const

function isApproximateTotal(
  data: GreenTablePage,
  page: number,
  pageSize: number,
): boolean {
  if (typeof data.total_exact === 'boolean') {
    return !data.total_exact
  }
  const rowsN = data.data?.length ?? 0
  return rowsN === pageSize && data.total === (page - 1) * pageSize + rowsN + 1
}

export type UseGreenTablePagedDataArgs = {
  baseQuery: string | null
  showGreenAssets: boolean
  /** Applied filters for the active table kind (committed via Cerca). */
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

  const appliedFiltersKey = useMemo(
    () => JSON.stringify(activeColumnFilters),
    [activeColumnFilters],
  )

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

  const prevFilterKey = useRef(
    `${appliedFiltersKey}|${String(sort)}|${String(showGreenAssets)}`,
  )
  const prevShowGreenAssets = useRef(showGreenAssets)
  useEffect(() => {
    const key = `${appliedFiltersKey}|${String(sort)}|${String(showGreenAssets)}`
    if (prevFilterKey.current === key) return
    prevFilterKey.current = key
    setPage(1)
    // Clear rows on filter/sort/kind change. Keeping prior rows when page stays 1
    // made Cerca look like a no-op (stale table, no loader) especially for AND
    // filters while the request is in flight. SWR keepRows is only for exactTotalNonce.
    setPageData(null)
    pageDataRef.current = null
    displayedPageRef.current = null
    setTotalIsApproximate(false)
    approxRetriesRef.current = 0
    setExactTotalNonce(0)
    if (prevShowGreenAssets.current !== showGreenAssets) {
      prevShowGreenAssets.current = showGreenAssets
    }
  }, [appliedFiltersKey, sort, showGreenAssets])

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
    // SWR only for silent exact-total refresh (exactTotalNonce). Filter/Cerca/
    // page jumps clear rows and must show the blue-dots loader.
    const keepRowsVisible =
      exactTotalNonce > 0 &&
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
    if (appliedFiltersKey !== '{}') {
      for (const [k, v] of Object.entries(activeColumnFilters)) {
        if (!v || FILTER_SCOPE_DENYLIST.has(k)) continue
        params[k] = v
      }
    }

    const fetchFn = showGreenAssets ? fetchGreenAssetsTablePaged : fetchGreenAreasTablePaged

    // Wait out Cerca viewport DuckDB hold before table page fetch (debug 4fe799:
    // MinIO IO Error + NetworkError while viewport+table raced).
    const startFetch = () => {
      if (cancelled) return
      fetchFn(baseQuery, params, abort.signal)
      .then((data) => {
        if (cancelled) {
          return
        }
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
          // Defer exact-total polls while Cerca viewport holds DuckDB (debug 4fe799).
          const base = APPROX_RETRY_DELAYS_MS[approxRetriesRef.current] ?? 8000
          const burst = isViewportLoadBurstActive()
          const delay = burst ? Math.max(base, 15000) : base
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
        if (aborted) {
          return
        }
        const isNetwork =
          String(err).includes('NetworkError') ||
          String(err).includes('Failed to fetch') ||
          (err instanceof TypeError)
        // MinIO/DuckDB overload (debug 4fe799): one slow retry, then stop spinning.
        if (isNetwork && exactTotalNonce < 1) {
          const delay = isViewportLoadBurstActive() ? 4000 : 2000
          window.setTimeout(() => {
            if (!cancelled) setExactTotalNonce((n) => n + 1)
            else setLoading(false)
          }, delay)
          return
        }
        if (pageDataRef.current == null) {
          setPageData(null)
          setTotalIsApproximate(false)
        }
        setLoading(false)
      })
    }

    let burstWaitTimer: ReturnType<typeof setTimeout> | null = null
    if (isTableFetchBlocked()) {
      const waitedAt = Date.now()
      const poll = () => {
        if (cancelled) return
        const stillBurst = isTableFetchBlocked()
        const waitedMs = Date.now() - waitedAt
        if (!stillBurst || waitedMs > 90_000) {
          startFetch()
          return
        }
        burstWaitTimer = setTimeout(poll, 500)
      }
      burstWaitTimer = setTimeout(poll, 500)
    } else {
      startFetch()
    }

    return () => {
      cancelled = true
      abort.abort()
      if (approxTimer) clearTimeout(approxTimer)
      if (burstWaitTimer) clearTimeout(burstWaitTimer)
      // Abort previously ignored signal (debug 4fe799: table stuck loading forever).
      setLoading(false)
    }
  }, [
    baseQuery,
    showGreenAssets,
    page,
    pageSize,
    sort,
    activeColumnFilters,
    appliedFiltersKey,
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
