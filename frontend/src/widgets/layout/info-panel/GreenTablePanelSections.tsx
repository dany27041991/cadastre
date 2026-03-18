/**
 * InfoPanel sections: map table column picker and filters (dxc-webkit).
 */
import '@/features/territory/ui/green-data-table/green-data-table.css'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Box, Checkbox, SearchInput, Text, icons } from 'dxc-webkit'
import { useGreenTablePanelOptional } from '@/features/territory/context/GreenTablePanelContext'
import { labelizeGreenColumn } from '@/features/territory/lib/greenTableColumnLabel'

export function GreenTablePanelSections() {
  const { t } = useTranslation()
  const panel = useGreenTablePanelOptional()

  const filterColumnOptions = useMemo(() => {
    if (!panel?.allColumnKeys.length) return []
    const all = t('territory.panel.filterAllColumns')
    return [
      { value: '', label: all },
      ...panel.allColumnKeys.map((k) => ({
        value: k,
        label: labelizeGreenColumn(k),
      })),
    ]
  }, [panel?.allColumnKeys, t])

  if (!panel) {
    return null
  }

  const {
    optionalColumnKeys,
    extraColumns,
    toggleExtraColumn,
    filterText,
    setFilterText,
    filterColumnKey,
    setFilterColumnKey,
    tablePanelActive,
  } = panel

  if (!tablePanelActive) {
    return (
      <Box as="div" padding="s" style={{ marginBottom: '1rem' }}>
        <Text font="f1-body-sm" style={{ color: 'var(--gray-600, #6c757d)' }}>
          {t('territory.panel.tableContextHint')}
        </Text>
      </Box>
    )
  }

  return (
    <>
      <Box as="div" style={{ marginBottom: '1.25rem' }}>
        <Text
          font="f1-label-sm"
          color="primary"
          style={{
            display: 'block',
            marginBottom: '0.5rem',
            fontWeight: 700,
          }}
        >
          {t('territory.panel.sectionTableManagement')}
        </Text>
        <Text
          font="f1-body-sm"
          style={{
            marginBottom: '0.75rem',
            display: 'block',
            color: 'var(--gray-600, #6c757d)',
          }}
        >
          {t('territory.panel.sectionTableManagementSub')}
        </Text>
        {optionalColumnKeys.length === 0 ? (
          <Text font="f1-body-sm" style={{ color: 'var(--gray-600, #6c757d)' }}>
            {t('territory.panel.noOptionalColumns')}
          </Text>
        ) : (
          <Box
            as="div"
            className="scrollable-container-sm"
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '0.65rem',
              maxHeight: '14rem',
              overflowY: 'auto',
              paddingRight: '0.25rem',
            }}
          >
            {optionalColumnKeys.map((key) => {
              const checked = extraColumns.includes(key)
              return (
                <Checkbox
                  key={key}
                  name={`green-table-col-${key}`}
                  className="green-table-panel-checkbox-sm"
                  label={labelizeGreenColumn(key)}
                  helperText={t('territory.panel.optionalColumnHelper', { key })}
                  checked={checked}
                  onChange={(value) => {
                    if (value !== checked) toggleExtraColumn(key)
                  }}
                />
              )
            })}
          </Box>
        )}
      </Box>

      <Box as="div" style={{ marginBottom: '1.25rem' }}>
        <Text
          font="f1-label-sm"
          color="primary"
          style={{
            display: 'block',
            marginBottom: '0.5rem',
            fontWeight: 700,
          }}
        >
          {t('territory.panel.sectionTableFilter')}
        </Text>
        <Text
          font="f1-body-sm"
          style={{
            marginBottom: '0.75rem',
            display: 'block',
            color: 'var(--gray-600, #6c757d)',
          }}
        >
          {t('territory.panel.sectionTableFilterSub')}
        </Text>
        <Box as="div" style={{ marginBottom: '0.75rem' }}>
          <SearchInput
            label={t('territory.panel.filterColumnLabel')}
            placeholderText={t('territory.panel.filterColumnPlaceholder')}
            PlaceholderIcon={icons.SearchIcon}
            options={filterColumnOptions}
            value={filterColumnKey}
            onChange={(v) => setFilterColumnKey(typeof v === 'string' ? v : '')}
            showArrow
            thick={false}
            isSearchable
            isClearable
          />
        </Box>
        <SearchInput
          label={t('territory.panel.filterTextLabel')}
          placeholderText={t('territory.panel.filterTextPlaceholder')}
          PlaceholderIcon={icons.SearchIcon}
          options={[]}
          value={filterText}
          onChange={(v) => setFilterText(typeof v === 'string' ? v : '')}
          showArrow={false}
          thick={false}
          isSearchable
          isClearable
        />
      </Box>
    </>
  )
}
