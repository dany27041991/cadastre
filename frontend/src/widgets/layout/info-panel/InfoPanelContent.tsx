/**
 * Contenuto InfoPanel con filtri dxc-webkit: SearchInput, RadioButton, DatePicker.
 * Allineato al template "mappa secondaria" (Nome CU, tematica, area, periodo).
 */
import { useState } from 'react'
import {
  Box,
  InfoPanel,
  SearchInput,
  RadioButton,
  DatePicker,
  icons,
} from 'dxc-webkit'

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
      }}
    >
      <InfoPanel
        optionSearchBar={[]}
        boxSubTitleTitle="Filtro"
        boxSubTitleSub="Lorem ipsum dolor sit amet consectetur. Tortor sit porttitor nec egestas eget vitae a. Ornare sit sed morbi augue. Auctor pulvinar purus orci egestas consequat scelerisque enim."
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
            maxHeight: '20rem',
            paddingRight: '1rem',
          }}
        >
          <Box as="div" style={{ marginTop: '1rem' }}>
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
        </div>
      </InfoPanel>
    </Box>
  )
}
