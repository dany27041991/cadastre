/**
 * Shared state between InfoPanel options and the green areas/trees map table.
 */
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react'

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
  /** Accordion + InfoPanel visible only when the API returns table rows. */
  readonly mapTableAccordionVisible: boolean
  readonly setMapTableAccordionVisible: (v: boolean) => void
  readonly greenTableRows: Record<string, unknown>[]
  readonly setGreenTableRows: (rows: Record<string, unknown>[]) => void
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
  const [greenTableRows, setGreenTableRows] = useState<Record<string, unknown>[]>([])

  const resetPanelState = useCallback(() => {
    setExtraColumns([])
    setFilterText('')
    setFilterColumnKey('')
  }, [])

  const registerTableColumns = useCallback((allKeys: string[], defaultFive: string[]) => {
    setAllColumnKeys(allKeys)
    setOptionalColumnKeys(allKeys.filter((k) => !defaultFive.includes(k)))
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
      greenTableRows,
      setGreenTableRows,
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
      greenTableRows,
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
