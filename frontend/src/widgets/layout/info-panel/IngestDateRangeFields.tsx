/**
 * Ingest date range for green lakehouse queries — InfoPanel Layers step.
 *
 * Calendar uses popperContainer → body portal (InfoPanel has overflow:auto).
 * Portal wrapper must keep DXC classes (`custom-form-group`) so calendar CSS still applies.
 */
import type { ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { DatePicker, Text } from 'dxc-webkit'
import { useGreenTablePanelOptional } from '@/features/territory/context/GreenTablePanelContext'
import styles from './IngestDateRangeFields.module.css'

const INGEST_DATEPICKER_PORTAL_ID = 'linfa-ingest-datepicker-portal'

/** Same root classes DXC DatePicker uses on FormGroup (see DatePicker.js). */
const DXC_DATEPICKER_ROOT_CLASS =
  'form-group custom-form-group date-time-picker-wrapper'

function ensureIngestDatepickerPortal(): HTMLElement {
  let el = document.getElementById(INGEST_DATEPICKER_PORTAL_ID)
  if (!el) {
    el = document.createElement('div')
    el.id = INGEST_DATEPICKER_PORTAL_ID
    document.body.appendChild(el)
  }
  return el
}

/**
 * DXC/react-datepicker popperContainer: wrap + portal.
 * Without `.custom-form-group`, day-grid typography/colors from dxc style.css break.
 */
function ingestDatepickerPopperContainer({ children }: { children?: ReactNode }) {
  return createPortal(
    <div className={DXC_DATEPICKER_ROOT_CLASS}>{children}</div>,
    ensureIngestDatepickerPortal(),
  )
}

export function IngestDateRangeFields() {
  const { t } = useTranslation()
  const panel = useGreenTablePanelOptional()
  if (!panel) return null

  const { dateFrom, dateTo, setDateFrom, setDateTo } = panel

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
            locale="it"
            customDateFormat="dd/MM/yyyy"
            max={dateTo ?? undefined}
            isClearable
            popperContainer={ingestDatepickerPopperContainer}
            onChange={(date) => {
              setDateFrom(date ?? null)
            }}
            onCustomClear={() => setDateFrom(null)}
          />
        </div>
        <div className={styles.field}>
          <DatePicker
            name="ingestDateTo"
            label={`${t('territory.panel.dateTo')} *`}
            value={dateTo}
            locale="it"
            customDateFormat="dd/MM/yyyy"
            min={dateFrom ?? undefined}
            isClearable
            popperContainer={ingestDatepickerPopperContainer}
            onChange={(date) => {
              setDateTo(date ?? null)
            }}
            onCustomClear={() => setDateTo(null)}
          />
        </div>
      </div>
    </div>
  )
}
