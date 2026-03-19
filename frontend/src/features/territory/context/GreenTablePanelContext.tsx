/**
 * Shared state between InfoPanel options and the green areas/trees map table.
 *
 * Server-side mode: the context no longer holds the full row array in memory.
 * GreenDataTable owns its own paginated fetch; the context only holds the UI
 * state that is shared across the InfoPanel (column picker, filter inputs).
 */
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react'

import { isGreenTableIdColumn } from '../lib/greenTableColumnVisibility'

export interface GreenTablePanelContextValue {
  readonly extraColumns: string[]
  readonly toggleExtraColumn: (key: string) => void
  readonly filterText: string
  readonly setFilterText: (v: string) => void
  readonly filterColumnKey: string
  readonly setFilterColumnKey: (v: string) => void
  readonly optionalColumnKeys: string[]
  readonly allColumnKeys: string[]
  readonly tablePanelActive: boolean
  readonly setTablePanelActive: (v: boolean) => void
  readonly registerTableColumns: (allKeys: string[], defaultFive: string[]) => void
  readonly resetPanelState: () => void
  /** Accordion + InfoPanel visible only when the table endpoint confirms rows exist. */
  readonly mapTableAccordionVisible: boolean
  readonly setMapTableAccordionVisible: (v: boolean) => void
}

const GreenTablePanelContext = createContext<GreenTablePanelContextValue | null>(null)

export function GreenTablePanelProvider({ children }: { readonly children: ReactNode }) {
  const [extraColumns, setExtraColumns] = useState<string[]>([])
  const [filterText, setFilterText] = useState('')
  const [filterColumnKey, setFilterColumnKey] = useState('')
  const [optionalColumnKeys, setOptionalColumnKeys] = useState<string[]>([])
  const [allColumnKeys, setAllColumnKeys] = useState<string[]>([])
  const [tablePanelActive, setTablePanelActive] = useState(false)
  const [mapTableAccordionVisible, setMapTableAccordionVisible] = useState(false)

  const resetPanelState = useCallback(() => {
    setExtraColumns([])
    setFilterText('')
    setFilterColumnKey('')
  }, [])

  const registerTableColumns = useCallback((allKeys: string[], defaultFive: string[]) => {
    setAllColumnKeys(allKeys)
    setOptionalColumnKeys(allKeys.filter((k) => !defaultFive.includes(k)))
    setExtraColumns((prev) => prev.filter((k) => allKeys.includes(k)))
    setFilterColumnKey((prev) => {
      if (!prev) return prev
      if (!allKeys.includes(prev) || isGreenTableIdColumn(prev)) return ''
      return prev
    })
  }, [])

  const toggleExtraColumn = useCallback((key: string) => {
    setExtraColumns((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    )
  }, [])

  const value = useMemo(
    () => ({
      extraColumns,
      toggleExtraColumn,
      filterText,
      setFilterText,
      filterColumnKey,
      setFilterColumnKey,
      optionalColumnKeys,
      allColumnKeys,
      tablePanelActive,
      setTablePanelActive,
      registerTableColumns,
      resetPanelState,
      mapTableAccordionVisible,
      setMapTableAccordionVisible,
    }),
    [
      extraColumns,
      toggleExtraColumn,
      filterText,
      filterColumnKey,
      optionalColumnKeys,
      allColumnKeys,
      tablePanelActive,
      registerTableColumns,
      resetPanelState,
      mapTableAccordionVisible,
    ]
  )

  return (
    <GreenTablePanelContext.Provider value={value}>{children}</GreenTablePanelContext.Provider>
  )
}

export function useGreenTablePanel(): GreenTablePanelContextValue {
  const ctx = useContext(GreenTablePanelContext)
  if (!ctx) {
    throw new Error('useGreenTablePanel must be used within GreenTablePanelProvider')
  }
  return ctx
}

/** Optional hook when InfoPanel may render outside the provider (tests): returns null. */
export function useGreenTablePanelOptional(): GreenTablePanelContextValue | null {
  return useContext(GreenTablePanelContext)
}
