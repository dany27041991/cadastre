/**
 * InfoPanel body: map table sections (dxc-webkit) and filter templates.
 */
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Box,
  InfoPanel,
  SearchInput,
  RadioButton,
  DatePicker,
  icons,
} from 'dxc-webkit'
import { useGreenTablePanelOptional } from '@/features/territory/context/GreenTablePanelContext'
import { GreenTablePanelSections } from './GreenTablePanelSections'

const OPTIONS = [
  { value: 'chocolate', label: 'Chocolate' },
  { value: 'strawberry', label: 'Strawberry' },
  { value: 'vanilla', label: 'Vanilla' },
]

const POPPER_CONTAINER = ({
  children,
}: {
  children?: React.ReactNode
}) => (
  <div style={{ position: 'fixed', zIndex: 1050 }}>{children}</div>
)

export function InfoPanelContent() {
  const { t } = useTranslation()
  const panel = useGreenTablePanelOptional()

  useEffect(() => {
    if (!panel?.filterColumnKey || !panel.allColumnKeys.length) return
    if (
      panel.filterColumnKey !== '' &&
      !panel.allColumnKeys.includes(panel.filterColumnKey)
    ) {
      panel.setFilterColumnKey('')
    }
  }, [panel?.filterColumnKey, panel?.allColumnKeys, panel?.setFilterColumnKey])

  const [selectedTematica, setSelectedTematica] = useState<string | undefined>()
  const [selectedBacino, setSelectedBacino] = useState<string | undefined>()
  const [radioValue, setRadioValue] = useState('')
  const [dateStart, setDateStart] = useState<Date | null>(null)
  const [dateEnd, setDateEnd] = useState<Date | null>(null)

  return (
    <Box
      as="div"
      style={{
        height: '100%',
        background: 'white',
        overflow: 'auto',
        paddingTop: '1rem',
        paddingBottom: '1.25rem',
        boxSizing: 'border-box',
      }}
    >
      <InfoPanel
        optionSearchBar={[]}
        boxSubTitleTitle={t('territory.panel.infoPanelSubtitle')}
        textBtnNew="Label text"
        textBtnPre="Label text"
        onClickBtnNew={() => {}}
        onClickBtnPre={() => {}}
        searchText={undefined}
        hideSearch
      >
        <div
          className="scrollable-container-sm"
          style={{
            textAlign: 'left',
            maxHeight: 'calc(100vh - 8rem)',
            paddingRight: '1rem',
          }}
        >
          {panel != null && (
            <Box as="div" style={{ marginTop: '0.5rem' }}>
              <GreenTablePanelSections />
            </Box>
          )}

          <Box
            as="div"
            style={{
              marginTop: '1.25rem',
              paddingTop: '1rem',
              borderTop: '1px solid var(--gray-100, #e9ecef)',
            }}
          >
            <p
              style={{
                color: 'var(--primary-active)',
                marginBottom: '0.75rem',
                fontSize: '0.875rem',
                fontWeight: 700,
              }}
            >
              {t('territory.panel.legacyFiltersSection')}
            </p>
            <Box as="div" style={{ marginTop: '0.5rem' }}>
              <SearchInput
                placeholderText="Search..."
                PlaceholderIcon={icons.SearchIcon}
                options={[]}
                value=""
                onChange={() => {}}
                showArrow={false}
                thick={false}
                isSearchable
                isClearable
              />
            </Box>
            <Box as="div" style={{ marginTop: '1rem' }}>
              <SearchInput
                placeholderText="Label Text"
                label="Seleziona tematica"
                options={OPTIONS}
                value={selectedTematica}
                onChange={setSelectedTematica}
                showArrow
                thick={false}
                isSearchable={false}
                isClearable={false}
              />
            </Box>
            <Box as="div" style={{ marginTop: '1rem' }}>
              <p
                style={{
                  color: 'var(--primary-active)',
                  marginBottom: 0,
                }}
              >
                <b>Selezione area d&apos;interesse</b>
              </p>
              <div className="d-flex align-items-left gap-1">
                <div>
                  <RadioButton
                    label="Bacino"
                    color="primary"
                    disabled={false}
                    value="Radio1"
                    name="radio-managed"
                    onChange={(value) => setRadioValue(value)}
                    checkedValue={radioValue}
                  />
                </div>
                <div>
                  <RadioButton
                    label="Sottobacino"
                    color="primary"
                    disabled={false}
                    value="Radio2"
                    name="radio-managed"
                    onChange={(value) => setRadioValue(value)}
                    checkedValue={radioValue}
                  />
                </div>
              </div>
              <SearchInput
                placeholderText="Bacino del SELE"
                options={OPTIONS}
                value={selectedBacino}
                onChange={setSelectedBacino}
                showArrow
                thick={false}
                isSearchable={false}
                isClearable={false}
              />
            </Box>
            <Box as="div" style={{ marginTop: '1rem' }}>
              <p
                style={{
                  color: 'var(--primary-active)',
                  marginBottom: 0,
                }}
              >
                <b>Seleziona periodo temporale</b>
              </p>
              <DatePicker
                name="start"
                color="primary"
                label="Data inizio"
                placeholder="GG/MM/AAAA"
                max={new Date()}
                value={dateStart}
                onChange={(date) => setDateStart(date)}
                onCustomClear={() => setDateStart(null)}
                popperContainer={POPPER_CONTAINER}
              />
              <DatePicker
                name="end"
                color="primary"
                label="Data fine"
                placeholder="GG/MM/AAAA"
                min={dateStart ?? undefined}
                max={new Date()}
                disabled={!dateStart}
                value={dateEnd}
                onChange={(date) => setDateEnd(date)}
                onCustomClear={() => setDateEnd(null)}
                popperContainer={POPPER_CONTAINER}
              />
            </Box>
          </Box>
        </div>
      </InfoPanel>
    </Box>
  )
}
