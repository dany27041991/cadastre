/**
 * Shared state between InfoPanel options and the green areas/trees map table.
 *
 * Server-side mode: GreenDataTable owns paginated fetch; context holds UI state
 * shared with the InfoPanel (multi-field column filters). Column visibility lives
 * in the table toolbar + localStorage.
 */
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react'

import type { GreenTableKind } from '../lib/greenDetailColumnCatalog'
import type { BreadcrumbCrumb } from '../types'
import type { TerritorySearchHit } from '../types/territorySearch'

export type ColumnFiltersMap = Readonly<Record<string, string>>

export interface GreenAssetsLayerControls {
  /** Assets Verdi toggle (viewport clusters / raw assets). */
  readonly active: boolean
  /** Aree Gestite toggle (green-area polygons; zoom-gated in viewport mode). */
  readonly areasActive: boolean
  readonly loading: boolean
  readonly available: boolean
  readonly setActive: (active: boolean) => void | Promise<void>
  readonly setAreasActive: (active: boolean) => void | Promise<void>
}

/** Nav bridge for LayersPanel territory SearchInput (registered by TerritoryMapWidget). */
export interface TerritorySearchNavControls {
  readonly breadcrumb: readonly BreadcrumbCrumb[]
  readonly jumpToSearchHit: (hit: TerritorySearchHit) => Promise<void>
  readonly loadRegions: (options?: { fit?: boolean }) => Promise<void>
  readonly loading: boolean
  /** Open GreenDetailModal for a green/sub-area search hit (same as table/map select). */
  readonly openGreenAreaDetail: (hit: TerritorySearchHit) => void
  /** Close GreenDetailModal (search clear / non-green hit). */
  readonly closeGreenDetail: () => void
}

export interface GreenTablePanelContextValue {
  readonly columnFiltersByKind: {
    readonly area: ColumnFiltersMap
    readonly asset: ColumnFiltersMap
  }
  readonly setColumnFilter: (kind: GreenTableKind, key: string, value: string) => void
  readonly clearColumnFilters: (kind: GreenTableKind) => void
  /** Table kind currently shown (registered by GreenDataTable). */
  readonly activeTableKind: GreenTableKind
  readonly setActiveTableKind: (kind: GreenTableKind) => void
  readonly tablePanelActive: boolean
  readonly setTablePanelActive: (v: boolean) => void
  readonly resetPanelState: () => void
  /** Accordion open state (table sections in the InfoPanel follow it). */
  readonly mapTableAccordionVisible: boolean
  readonly setMapTableAccordionVisible: (v: boolean) => void
  /** True while InfoPanel is on the layers step (toggles + green tables). */
  readonly layersPanelOpen: boolean
  readonly setLayersPanelOpen: (v: boolean) => void
  readonly greenAssetsLayer: GreenAssetsLayerControls | null
  readonly registerGreenAssetsLayer: (controls: GreenAssetsLayerControls | null) => void
  /** Full reset to Italy landing (Indietro from layers panel). */
  readonly resetToLanding: (() => void) | null
  readonly registerResetToLanding: (fn: (() => void) | null) => void
  readonly territorySearchNav: TerritorySearchNavControls | null
  readonly registerTerritorySearchNav: (controls: TerritorySearchNavControls | null) => void
  /**
   * When true, Aree gestite stays ON and the toggle is disabled until the
   * territory SearchInput is cleared (green-area / sub-area search lock).
   */
  readonly areasToggleLockedByGreenSearch: boolean
  readonly setAreasToggleLockedByGreenSearch: (locked: boolean) => void
}

const EMPTY_FILTERS: ColumnFiltersMap = Object.freeze({})

const GreenTablePanelContext = createContext<GreenTablePanelContextValue | null>(null)

export function GreenTablePanelProvider({ children }: { readonly children: ReactNode }) {
  const [columnFiltersByKind, setColumnFiltersByKind] = useState<{
    area: ColumnFiltersMap
    asset: ColumnFiltersMap
  }>({ area: EMPTY_FILTERS, asset: EMPTY_FILTERS })
  const [activeTableKind, setActiveTableKind] = useState<GreenTableKind>('area')
  const [tablePanelActive, setTablePanelActive] = useState(false)
  const [mapTableAccordionVisible, setMapTableAccordionVisible] = useState(false)
  const [layersPanelOpen, setLayersPanelOpen] = useState(false)
  const [greenAssetsLayer, setGreenAssetsLayer] = useState<GreenAssetsLayerControls | null>(null)
  const [resetToLanding, setResetToLanding] = useState<(() => void) | null>(null)
  const [territorySearchNav, setTerritorySearchNav] = useState<TerritorySearchNavControls | null>(
    null
  )
  const [areasToggleLockedByGreenSearch, setAreasToggleLockedByGreenSearch] = useState(false)

  const registerGreenAssetsLayer = useCallback((controls: GreenAssetsLayerControls | null) => {
    setGreenAssetsLayer((prev) => {
      if (controls == null) return prev == null ? prev : null
      if (
        prev != null &&
        prev.active === controls.active &&
        prev.areasActive === controls.areasActive &&
        prev.loading === controls.loading &&
        prev.available === controls.available &&
        prev.setActive === controls.setActive &&
        prev.setAreasActive === controls.setAreasActive
      ) {
        return prev
      }
      return controls
    })
  }, [])

  const registerResetToLanding = useCallback((fn: (() => void) | null) => {
    setResetToLanding((prev) => {
      if (prev === fn) return prev
      return fn
    })
  }, [])

  const registerTerritorySearchNav = useCallback((controls: TerritorySearchNavControls | null) => {
    setTerritorySearchNav((prev) => {
      if (controls == null) return prev == null ? prev : null
      if (
        prev != null &&
        prev.breadcrumb === controls.breadcrumb &&
        prev.jumpToSearchHit === controls.jumpToSearchHit &&
        prev.loadRegions === controls.loadRegions &&
        prev.loading === controls.loading &&
        prev.openGreenAreaDetail === controls.openGreenAreaDetail &&
        prev.closeGreenDetail === controls.closeGreenDetail
      ) {
        return prev
      }
      return controls
    })
  }, [])

  const setColumnFilter = useCallback((kind: GreenTableKind, key: string, value: string) => {
    setColumnFiltersByKind((prev) => {
      const current = prev[kind]
      const nextVal = value
      if ((current[key] ?? '') === nextVal) return prev
      const next: Record<string, string> = { ...current }
      if (nextVal === '') {
        delete next[key]
      } else {
        next[key] = nextVal
      }
      return { ...prev, [kind]: next }
    })
  }, [])

  const clearColumnFilters = useCallback((kind: GreenTableKind) => {
    setColumnFiltersByKind((prev) => {
      if (Object.keys(prev[kind]).length === 0) return prev
      return { ...prev, [kind]: EMPTY_FILTERS }
    })
  }, [])

  const resetPanelState = useCallback(() => {
    setColumnFiltersByKind({ area: EMPTY_FILTERS, asset: EMPTY_FILTERS })
    setActiveTableKind('area')
    setTablePanelActive(false)
    setMapTableAccordionVisible(false)
    setLayersPanelOpen(false)
    setAreasToggleLockedByGreenSearch(false)
  }, [])

  const value = useMemo(
    () => ({
      columnFiltersByKind,
      setColumnFilter,
      clearColumnFilters,
      activeTableKind,
      setActiveTableKind,
      tablePanelActive,
      setTablePanelActive,
      resetPanelState,
      mapTableAccordionVisible,
      setMapTableAccordionVisible,
      layersPanelOpen,
      setLayersPanelOpen,
      greenAssetsLayer,
      registerGreenAssetsLayer,
      resetToLanding,
      registerResetToLanding,
      territorySearchNav,
      registerTerritorySearchNav,
      areasToggleLockedByGreenSearch,
      setAreasToggleLockedByGreenSearch,
    }),
    [
      columnFiltersByKind,
      setColumnFilter,
      clearColumnFilters,
      activeTableKind,
      tablePanelActive,
      resetPanelState,
      mapTableAccordionVisible,
      layersPanelOpen,
      greenAssetsLayer,
      registerGreenAssetsLayer,
      resetToLanding,
      registerResetToLanding,
      territorySearchNav,
      registerTerritorySearchNav,
      areasToggleLockedByGreenSearch,
    ],
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
