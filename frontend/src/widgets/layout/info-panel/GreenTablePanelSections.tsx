/**
 * InfoPanel multi-field table filters.
 * Shows area and/or asset catalogs based on layer toggles.
 * Controls: SearchInput (enum), DatePicker (dates), Input text/number — dxc-webkit only.
 */
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Box, DatePicker, Input, SearchInput, Text, icons } from 'dxc-webkit'
import { useGreenTablePanelOptional } from '@/features/territory/context/GreenTablePanelContext'
import type { GreenTableKind } from '@/features/territory/lib/greenDetailColumnCatalog'
import {
  FILTER_ENUM_VALUES,
  filterControlKind,
  filterLayoutFor,
  formatFilterDate,
  parseFilterDate,
} from '@/features/territory/lib/greenTableFilterFields'
import { Line } from '@/shared/ui'
import styles from './GreenTablePanelSections.module.css'

function rowClassName(cols: number): string {
  if (cols >= 3) return `${styles.row} ${styles.row3}`
  if (cols === 1) return `${styles.row} ${styles.row1}`
  return styles.row
}

export function GreenTablePanelSections() {
  const { t, i18n } = useTranslation()
  const panel = useGreenTablePanelOptional()

  const areasActive = panel?.greenAssetsLayer?.areasActive === true
  const assetsActive = panel?.greenAssetsLayer?.active === true
  const showArea = areasActive
  const showAsset = assetsActive
  const dateLocale = i18n.language?.startsWith('en') ? 'en' : 'it'

  const enumOptionsByKey = useMemo(() => {
    const out: Record<string, Array<{ value: string; label: string }>> = {}
    for (const [key, values] of Object.entries(FILTER_ENUM_VALUES)) {
      out[key] = values.map((value) => ({
        value,
        label: t(`territory.panel.enums.${key}.${value}`, {
          defaultValue: value,
        }),
      }))
    }
    return out
  }, [t, i18n.language])

  if (!panel) {
    return null
  }

  if (!showArea && !showAsset) {
    return (
      <Box as="div" padding="s" style={{ marginBottom: '1rem' }}>
        <Text font="f1-body-sm" style={{ color: 'var(--gray-600, #6c757d)' }}>
          {t('territory.panel.filtersNeedLayerHint')}
        </Text>
      </Box>
    )
  }

  const renderField = (kind: GreenTableKind, key: string) => {
    const filters = panel.columnFiltersByKind[kind]
    const label = t(`territory.panel.detail.meta.${key}`, { defaultValue: key })
    const value = filters[key] ?? ''
    const setValue = (next: string) => panel.setColumnFilter(kind, key, next)
    const control = filterControlKind(kind, key)
    const fieldKey = `${kind}-${key}`

    if (control === 'enum') {
      return (
        <Box as="div" key={fieldKey} className={styles.field}>
          <SearchInput
            label={label}
            placeholderText={t('territory.panel.filterSelectPlaceholder')}
            PlaceholderIcon={icons.SearchIcon}
            options={enumOptionsByKey[key] ?? []}
            value={value}
            onChange={(v) => setValue(typeof v === 'string' ? v : '')}
            showArrow
            thick={false}
            isSearchable
            isClearable
          />
        </Box>
      )
    }

    if (control === 'date') {
      return (
        <Box as="div" key={fieldKey} className={styles.field}>
          <DatePicker
            name={`green-filter-${kind}-${key}`}
            label={label}
            value={parseFilterDate(value)}
            onChange={(date) => setValue(formatFilterDate(date ?? null))}
            locale={dateLocale}
            placeholder={t('territory.panel.filterDatePlaceholder')}
            helperText={t('territory.panel.filterDateHelper')}
            customDateFormat="dd/MM/yyyy"
            isClearable
          />
        </Box>
      )
    }

    if (control === 'number' || control === 'integer') {
      return (
        <Box as="div" key={fieldKey} className={styles.field}>
          <Input
            name={`green-filter-${kind}-${key}`}
            type="number"
            inputMode={control === 'integer' ? 'numeric' : 'decimal'}
            step={control === 'integer' ? 1 : 'any'}
            label={label}
            value={value}
            placeholder={t('territory.panel.filterNumberPlaceholder')}
            isClearable
            onClear={() => setValue('')}
            onChange={(v) => setValue(typeof v === 'string' ? v : '')}
          />
        </Box>
      )
    }

    return (
      <Box as="div" key={fieldKey} className={styles.field}>
        <Input
          name={`green-filter-${kind}-${key}`}
          type="text"
          label={label}
          value={value}
          placeholder={t('territory.panel.filterTextPlaceholder')}
          isClearable
          onClear={() => setValue('')}
          onChange={(v) => setValue(typeof v === 'string' ? v : '')}
        />
      </Box>
    )
  }

  const renderKindSection = (kind: GreenTableKind, title: string, withTitle: boolean) => {
    const layout = filterLayoutFor(kind)
    return (
      <Box as="div" className={styles.section}>
        {withTitle ? (
          <Text as="p" font="f1-label-sm" color="primary" className={styles.sectionTitle}>
            {title}
          </Text>
        ) : null}
        <Box as="div" className={styles.grid}>
          {layout.map((keys) => (
            <Box as="div" key={`${kind}-${keys.join('-')}`} className={rowClassName(keys.length)}>
              {keys.map((key) => renderField(kind, key))}
            </Box>
          ))}
        </Box>
      </Box>
    )
  }

  const both = showArea && showAsset

  return (
    <Box as="div" className={styles.root}>
      <Text
        font="f1-style-h1-bold"
        style={{ fontSize: '20px', fontWeight: 600 }}
        className="mt-1"
        color="text-primary"
      >
        {t('territory.panel.filtersTitle')}
      </Text>
      <Line />
      <Text
        as="p"
        font="f1-body-sm"
        color="text-body"
        style={{ marginTop: '0.75rem', marginBottom: '1rem' }}
      >
        {t('territory.panel.filtersDescription')}
      </Text>
      {showArea
        ? renderKindSection('area', t('territory.panel.managedAreasToggle'), both)
        : null}
      {showAsset
        ? renderKindSection('asset', t('territory.panel.greenAssetsToggle'), both)
        : null}
    </Box>
  )
}
