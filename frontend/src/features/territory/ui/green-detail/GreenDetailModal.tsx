/**
 * Green area / asset detail — FloatingPanel glued to the clicked map point.
 * Follows pan/zoom by reprojecting the geographic anchor to screen coords.
 */
import type { CSSProperties, FC, ReactNode } from 'react'
import { useEffect, useLayoutEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Box, Button, FloatingPanel, Text } from 'dxc-webkit'
import { Spinner } from '@/shared/ui'
import type { GreenDetailDto } from '@/features/territory/api/greenDetail.api'
import type {
  GreenDetailSelection,
  GreenDetailStatus,
} from '@/features/territory/model/hooks/useGreenFeatureDetail'
import { useGreenDetailFollowMap } from '@/features/territory/model/hooks/useGreenDetailFollowMap'
import styles from './GreenDetailModal.module.css'

/** Gap between arrow tip and the clicked feature (must not cover the point). */
const ANCHOR_GAP_PX = 28
/** Prefer panel below the feature when this much vertical space is available under it. */
const PREFER_BELOW_MIN_PX = 280

export type GreenDetailModalProps = {
  isOpen: boolean
  status: GreenDetailStatus
  selection: GreenDetailSelection | null
  detail: GreenDetailDto | null
  errorNotFound: boolean
  onClose: () => void
  onDrill?: () => void
}

type MetaItem = { key: string; value: string }

function metadataLabel(
  t: (key: string, opts?: Record<string, string>) => string,
  key: string
): string {
  return t(`territory.panel.detail.meta.${key}`, { defaultValue: key })
}

function clampPanelLeft(clientX: number, panelWidth: number): number {
  const margin = 16
  const half = panelWidth / 2
  const min = margin + half
  const max = window.innerWidth - margin - half
  if (max <= min) return window.innerWidth / 2
  return Math.min(max, Math.max(min, clientX))
}

function toMetaRows(items: MetaItem[]): Array<[MetaItem, MetaItem | null]> {
  const rows: Array<[MetaItem, MetaItem | null]> = []
  for (let i = 0; i < items.length; i += 2) {
    rows.push([items[i], items[i + 1] ?? null])
  }
  return rows
}

function SummaryField({ label, value }: { label: string; value: string }) {
  return (
    <Text font="f1-body-sm" className={styles.summaryField}>
      <Text as="span" font="f1-body-sm" className={styles.summaryLabel} style={{ fontWeight: 700 }}>
        {label}:
      </Text>{' '}
      {value}
    </Text>
  )
}

function MetaCell({
  item,
  labelFor,
}: {
  item: MetaItem | null
  labelFor: (key: string) => string
}) {
  if (!item) return <Box as="div" className={styles.metaCell} />
  return (
    <Box as="div" className={styles.metaCell}>
      <Text font="f1-body-sm" className={styles.metaText}>
        <Text
          as="span"
          font="f1-body-sm"
          className={styles.metaKey}
          style={{ fontWeight: 700 }}
        >
          {labelFor(item.key)}:{' '}
        </Text>
        <Text as="span" font="f1-body-sm" className={styles.metaValue}>
          {item.value}
        </Text>
      </Text>
    </Box>
  )
}

export const GreenDetailModal: FC<GreenDetailModalProps> = ({
  isOpen,
  status,
  selection,
  detail,
  errorNotFound,
  onClose,
  onDrill,
}) => {
  const { t } = useTranslation()
  const [screen, setScreen] = useState({ clientX: 0, clientY: 0 })

  useLayoutEffect(() => {
    if (!selection) return
    setScreen({ clientX: selection.clientX, clientY: selection.clientY })
  }, [
    selection?.id,
    selection?.kind,
    selection?.anchorLon,
    selection?.anchorLat,
    selection?.clientX,
    selection?.clientY,
  ])

  useGreenDetailFollowMap(
    Boolean(isOpen && selection),
    selection?.anchorLon,
    selection?.anchorLat,
    (clientX, clientY) => setScreen({ clientX, clientY })
  )

  // Close when clicking anywhere outside the panel (map, sidebar, chrome).
  useEffect(() => {
    if (!isOpen) return
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target
      if (!(target instanceof Element)) return
      if (target.closest('[data-green-detail-panel]')) return
      onClose()
    }
    // Skip the same gesture that opened the panel.
    const timer = window.setTimeout(() => {
      document.addEventListener('pointerdown', onPointerDown, true)
    }, 0)
    return () => {
      window.clearTimeout(timer)
      document.removeEventListener('pointerdown', onPointerDown, true)
    }
  }, [isOpen, onClose])

  if (!isOpen || !selection) return null

  const kind = selection.kind
  const title =
    kind === 'asset'
      ? t('territory.panel.detail.titleAsset')
      : t('territory.panel.detail.titleArea')

  const summaryPrimaryLabel =
    kind === 'asset'
      ? detail?.summary.attributeTypeLabel?.trim() ||
        t('territory.panel.detail.summary.tree')
      : t('territory.panel.detail.summary.area')

  const primaryValue = detail?.summary.primaryLabel || selection.primaryLabel
  const regionValue =
    detail?.summary.regionLabel || selection.regionLabel || '—'
  const municipalityValue =
    detail?.summary.municipalityLabel || selection.municipalityLabel || '—'

  const metadata = detail?.metadata ?? []
  const metaRows = toMetaRows(metadata)
  // Only Esplodi when the area has children; hide CTA on leaf levels (no Seleziona).
  const showDrill = kind === 'area' && selection.canDrill === true
  const drillLabel = t('territory.panel.detail.drillSubAreas')
  const labelFor = (key: string) => metadataLabel(t, key)

  const panelWidth = Math.min(560, window.innerWidth - 32)
  const left = clampPanelLeft(screen.clientX, panelWidth)
  // Framed near top (20%): show detail below the point (arrow up). Fall back above only if no room.
  const placeBelow = window.innerHeight - screen.clientY >= PREFER_BELOW_MIN_PX
  const placeAbove = !placeBelow
  const arrowPosition = placeAbove ? 'down' : 'up'

  const anchorStyle: CSSProperties = placeAbove
    ? {
        left,
        bottom: Math.max(16, window.innerHeight - screen.clientY + ANCHOR_GAP_PX),
        width: panelWidth,
      }
    : {
        left,
        top: screen.clientY + ANCHOR_GAP_PX,
        width: panelWidth,
      }

  const topControls: ReactNode[] = [
    <Button key="close" color="white" kind="filled" size="sm" onClick={onClose}>
      {t('territory.panel.detail.close')}
    </Button>,
  ]

  return (
    <Box
      as="div"
      className={styles.anchor}
      style={anchorStyle}
      data-green-detail-panel
      data-arrow={arrowPosition}
    >
      <FloatingPanel
        title={title}
        dragIcon={false}
        disabled
        topControls={topControls}
        wrapperStyle={{
          position: 'relative',
          width: '100%',
          maxHeight: 'min(55vh, calc(100vh - 48px))',
        }}
        childrenWrapperStyle={{ padding: 0, overflow: 'hidden', minHeight: 0 }}
      >
        <Box as="div" className={styles.panelBody}>
          <Box as="div" className={styles.summaryBar}>
            <SummaryField label={summaryPrimaryLabel} value={primaryValue} />
            <SummaryField
              label={t('territory.panel.detail.summary.region')}
              value={regionValue}
            />
            <SummaryField
              label={t('territory.panel.detail.summary.municipality')}
              value={municipalityValue}
            />
          </Box>

          <Box as="div" className={styles.metadataSection}>
            <Text font="f1-body-sm" className={styles.metadataTitle} style={{ fontWeight: 700 }}>
              {t('territory.panel.detail.metadata')}
            </Text>

            {status === 'loading' ? (
              <Box as="div" display="flex" justify="center" className={styles.stateBlock}>
                <Spinner size="m" ariaLabel={t('territory.loading')} />
              </Box>
            ) : null}

            {status === 'error' ? (
              <Text font="f1-body-sm" color="danger">
                {errorNotFound
                  ? t('territory.panel.detail.notFound')
                  : t('territory.panel.detail.error')}
              </Text>
            ) : null}

            {status === 'ready' && metadata.length === 0 ? (
              <Text font="f1-body-sm">{t('territory.panel.detail.emptyMetadata')}</Text>
            ) : null}

            {status === 'ready' && metadata.length > 0 ? (
              <Box as="div" className={styles.metaTable} role="table">
                {metaRows.map(([leftItem, rightItem], rowIndex) => (
                  <Box
                    as="div"
                    key={`row-${rowIndex}`}
                    className={styles.metaRow}
                    role="row"
                  >
                    <MetaCell item={leftItem} labelFor={labelFor} />
                    <MetaCell item={rightItem} labelFor={labelFor} />
                  </Box>
                ))}
              </Box>
            ) : null}

            {showDrill ? (
              <Box as="div" className={styles.drillActions}>
                <Button
                  color="primary"
                  kind="filled"
                  size="sm"
                  onClick={() => {
                    onDrill?.()
                  }}
                >
                  {drillLabel}
                </Button>
              </Box>
            ) : null}
          </Box>
        </Box>
      </FloatingPanel>
    </Box>
  )
}
