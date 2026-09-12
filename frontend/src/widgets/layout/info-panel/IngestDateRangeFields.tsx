/**
 * Ingest date range for green lakehouse queries — InfoPanel Layers step.
 *
 * DXC DatePicker year control (SearchInput/react-select + SVG ArrowDownIcon):
 * - Indicator mousedown opens the menu but does not stopPropagation
 * - react-datepicker outside-click ignore only matches HTMLElement.classList on the
 *   event target (SVG never matches), so the calendar would close on year-arrow click
 * Fix: controlled `open` so year/month chrome (and portaled year menu) do not close.
 */
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { DatePicker, Text } from 'dxc-webkit'
import { useGreenTablePanelOptional } from '@/features/territory/context/GreenTablePanelContext'
import styles from './IngestDateRangeFields.module.css'

const INGEST_DATEPICKER_PORTAL_ID = 'linfa-ingest-datepicker-portal'

/** Same root classes DXC DatePicker uses on FormGroup (see DatePicker.js). */
const DXC_DATEPICKER_ROOT_CLASS =
  'form-group custom-form-group date-time-picker-wrapper'

/**
 * Year/month chrome inside DXC custom header + react-select menu options
 * (menu may portal outside .react-datepicker).
 */
const YEAR_MONTH_CHROME_SELECTOR = [
  '.year-options',
  '.months-controls',
  '.controls',
  '.datepicker-drop-down-icon',
  '.search-input-filled',
  '.search-input-option',
  '.search-input-option-text',
].join(', ')

function ensureIngestDatepickerPortal(): HTMLElement {
  let el = document.getElementById(INGEST_DATEPICKER_PORTAL_ID)
  if (!el) {
    el = document.createElement('div')
    el.id = INGEST_DATEPICKER_PORTAL_ID
    document.body.appendChild(el)
  }
  el.className = DXC_DATEPICKER_ROOT_CLASS
  return el
}

function shouldKeepCalendarOpen(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false
  return Boolean(target.closest(YEAR_MONTH_CHROME_SELECTOR))
}

type Bound = 'from' | 'to'

export function IngestDateRangeFields() {
  const { t } = useTranslation()
  const panel = useGreenTablePanelOptional()
  const [openFrom, setOpenFrom] = useState(false)
  const [openTo, setOpenTo] = useState(false)

  useEffect(() => {
    ensureIngestDatepickerPortal()
  }, [])

  useEffect(() => {
    if (panel?.entryMode === 'admin' && panel.adminTerritoryReady === false) {
      setOpenFrom(false)
      setOpenTo(false)
    }
  }, [panel?.entryMode, panel?.adminTerritoryReady])

  if (!panel) return null

  const { dateFrom, dateTo, setDateFrom, setDateTo, entryMode, adminTerritoryReady } = panel
  const datesDisabled = entryMode === 'admin' && !adminTerritoryReady

  const handleOutside = (bound: Bound, event?: { target?: EventTarget | null }) => {
    if (datesDisabled) return
    if (shouldKeepCalendarOpen(event?.target ?? null)) return
    if (bound === 'from') setOpenFrom(false)
    else setOpenTo(false)
  }

  const datePickerShared = {
    locale: 'it' as const,
    customDateFormat: 'dd/MM/yyyy',
    isClearable: true,
    portalId: INGEST_DATEPICKER_PORTAL_ID,
  }

  return (
    <div className={styles.wrap}>
      <Text font="f1-body-sm" color="text-body" className={styles.hint}>
        {t('territory.panel.ingestPeriodHint')}
      </Text>
      <div className={styles.row}>
        <div className={styles.field}>
          <DatePicker
            name="ingestDateFrom"
            label={`${t('territory.panel.dateFrom')} *`}
            value={dateFrom}
            max={dateTo ?? undefined}
            disabled={datesDisabled}
            {...datePickerShared}
            open={openFrom && !datesDisabled}
            onFocus={() => {
              if (!datesDisabled) setOpenFrom(true)
            }}
            onInputClick={() => {
              if (!datesDisabled) setOpenFrom(true)
            }}
            onCalendarOpen={() => {
              if (!datesDisabled) setOpenFrom(true)
            }}
            onClickOutside={(event: { target?: EventTarget | null }) =>
              handleOutside('from', event)
            }
            onChange={(date) => {
              if (datesDisabled) return
              setDateFrom(date ?? null)
              setOpenFrom(false)
            }}
            onCustomClear={() => {
              if (datesDisabled) return
              setDateFrom(null)
              setOpenFrom(false)
            }}
          />
        </div>
        <div className={styles.field}>
          <DatePicker
            name="ingestDateTo"
            label={`${t('territory.panel.dateTo')} *`}
            value={dateTo}
            min={dateFrom ?? undefined}
            disabled={datesDisabled}
            {...datePickerShared}
            open={openTo && !datesDisabled}
            onFocus={() => {
              if (!datesDisabled) setOpenTo(true)
            }}
            onInputClick={() => {
              if (!datesDisabled) setOpenTo(true)
            }}
            onCalendarOpen={() => {
              if (!datesDisabled) setOpenTo(true)
            }}
            onClickOutside={(event: { target?: EventTarget | null }) =>
              handleOutside('to', event)
            }
            onChange={(date) => {
              if (datesDisabled) return
              setDateTo(date ?? null)
              setOpenTo(false)
            }}
            onCustomClear={() => {
              if (datesDisabled) return
              setDateTo(null)
              setOpenTo(false)
            }}
          />
        </div>
      </div>
    </div>
  )
}
