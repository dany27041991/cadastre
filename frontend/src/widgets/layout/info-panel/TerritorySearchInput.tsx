/**
 * Hierarchy typeahead on Layers step — SearchInput synced with breadcrumb / jump.
 */
import { useCallback, useMemo, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { SearchInput, icons } from 'dxc-webkit'
import { territoryApi } from '@/features/territory'
import { useGreenTablePanelOptional } from '@/features/territory/context/GreenTablePanelContext'
import { territoryPathFromBreadcrumb } from '@/features/territory/lib/jumpToTerritorySearchHit'
import type { TerritorySearchHit } from '@/features/territory/types/territorySearch'
import styles from './TerritorySearchInput.module.css'

export function TerritorySearchInput() {
  const { t } = useTranslation()
  const panel = useGreenTablePanelOptional()
  const nav = panel?.territorySearchNav ?? null
  const hitsByValueRef = useRef(new Map<string, TerritorySearchHit>())

  const italiaLabel = t('territory.italia')
  const crumbLen = nav?.breadcrumb?.length ?? 0
  const hasSelection = crumbLen > 0
  const pathValue = hasSelection
    ? territoryPathFromBreadcrumb(nav!.breadcrumb, italiaLabel)
    : ''

  const selectedOptions = useMemo(
    () => (hasSelection && pathValue ? [{ value: pathValue, label: pathValue }] : []),
    [hasSelection, pathValue]
  )

  const loadOptions = useCallback(async (input: string) => {
    try {
      const hits = await territoryApi.searchTerritory(input ?? '')
      // National "Italia" is landing/clear — never offer it as a selectable filled value.
      const usable = hits.filter((hit) => hit.level !== 'italy')
      const labelCounts = new Map<string, number>()
      for (const hit of usable) {
        labelCounts.set(hit.label, (labelCounts.get(hit.label) ?? 0) + 1)
      }
      const next = new Map<string, TerritorySearchHit>()
      const options = usable.map((hit) => {
        // Unique option value (API already sends level:id). Same display labels
        // (e.g. many "Area verde" in Lecce) must not collide in the lookup map.
        const dup = (labelCounts.get(hit.label) ?? 0) > 1
        const label =
          dup && hit.id != null ? `${hit.label} (#${hit.id})` : hit.label
        next.set(hit.value, hit)
        return { value: hit.value, label }
      })
      hitsByValueRef.current = next
      return options
    } catch {
      return []
    }
  }, [])

  const handleChange = useCallback(
    (value: unknown) => {
      if (!nav) return
      const selected = typeof value === 'string' ? value : ''
      const setAreasActive = panel?.greenAssetsLayer?.setAreasActive
      const setLock = panel?.setAreasToggleLockedByGreenSearch
      const unlockAreasFromGreenSearch = async () => {
        if (panel?.areasToggleLockedByGreenSearch) {
          setLock?.(false)
          await setAreasActive?.(false)
        }
      }
      if (!selected || selected === italiaLabel) {
        void (async () => {
          nav.closeGreenDetail()
          await unlockAreasFromGreenSearch()
          await nav.loadRegions()
        })()
        return
      }
      // Controlled display uses breadcrumb path as option value — ignore no-op sync.
      if (selected === territoryPathFromBreadcrumb(nav.breadcrumb, italiaLabel)) return
      const hit = hitsByValueRef.current.get(selected)
      if (!hit || hit.level === 'italy') {
        void (async () => {
          nav.closeGreenDetail()
          await unlockAreasFromGreenSearch()
          await nav.loadRegions()
        })()
        return
      }
      // Same green/admin entity already selected — skip re-jump.
      const last = nav.breadcrumb[nav.breadcrumb.length - 1]
      if (
        last &&
        hit.id != null &&
        last.id === hit.id &&
        (hit.level === 'green_areas' || hit.level === 'sub_areas'
          ? last.level === 'sub_areas' || last.level === 'green_areas'
          : last.level === hit.level)
      ) {
        return
      }
      void (async () => {
        const isGreenHit = hit.level === 'green_areas' || hit.level === 'sub_areas'
        if (!isGreenHit) {
          nav.closeGreenDetail()
          await unlockAreasFromGreenSearch()
        }
        await nav.jumpToSearchHit(hit)
        // Green / sub-area search: force Aree gestite ON and lock the toggle.
        if (isGreenHit) {
          await setAreasActive?.(true)
          setLock?.(true)
          nav.openGreenAreaDetail(hit)
        }
      })()
    },
    [nav, italiaLabel, panel]
  )

  const handleClear = useCallback(() => {
    void (async () => {
      nav?.closeGreenDetail()
      if (panel?.areasToggleLockedByGreenSearch) {
        panel.setAreasToggleLockedByGreenSearch(false)
        await panel.greenAssetsLayer?.setAreasActive(false)
      }
      await nav?.loadRegions()
    })()
  }, [nav, panel])

  return (
    <div className={styles.wrap}>
      <SearchInput
        label={t('territory.panel.territorySearchLabel')}
        placeholderText={t('territory.panel.territorySearchPlaceholder')}
        PlaceholderIcon={icons.SearchIcon}
        value={pathValue}
        options={selectedOptions}
        onChange={handleChange}
        loadOptions={loadOptions}
        debounceTimeMillis={300}
        showArrow
        thick={false}
        isSearchable
        isClearable
        onClear={handleClear}
        disabled={!nav || nav.loading}
      />
    </div>
  )
}
