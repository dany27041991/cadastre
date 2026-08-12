/**
 * Main content: territory breadcrumb, map, and accordion with live green areas/assets table.
 */
import { useState, useCallback, useEffect, useRef, type ReactNode } from 'react'
import { MAP_UI_OVERLAY_Z_INDEX } from '@/features/territory-map-geoinsight/ui/geoinsightMapStyle'
import { useTranslation } from 'react-i18next'
import { Box, Accordion, AccordionItem, AccordionHeader, AccordionBody, Text } from 'dxc-webkit'
import { MapBreadcrumbs, type MapBreadcrumbsProps } from '@/features/territory'
import { GreenDataTable } from '@/features/territory/ui/green-data-table/GreenDataTable'
import type { GreenTableRawRow } from '@/features/territory/ui/green-data-table/GreenTableRowActions'
import { LoadingOverlay } from '@/features/territory/ui/loading-overlay/LoadingOverlay'
import { useGreenTablePanelOptional } from '@/features/territory/context/GreenTablePanelContext'

export interface MainContentProps extends MapBreadcrumbsProps {
  /** Geoinsight map slot. */
  readonly mapOverlay: ReactNode
  readonly children?: ReactNode
  /** Whether the green data table accordion is visible (layers panel + at least one toggle). */
  readonly showGreenTableAccordion: boolean
  readonly greenAreasLayerActive: boolean
  readonly greenAssetsLayerActive: boolean
  readonly areasTableQuery: string | null
  readonly assetsTableQuery: string | null
  readonly greenAssetsLayerLoading?: boolean
  /** Open green detail from table row actions (closes accordion while open). */
  readonly onOpenGreenDetail?: (row: GreenTableRawRow, kind: 'area' | 'asset') => void
}

function accordionTitleKey(areasActive: boolean, assetsActive: boolean): string {
  if (areasActive && assetsActive) return 'territory.accordion.tableTitleAreasAndAssets'
  if (assetsActive) return 'territory.accordion.tableTitleAssets'
  return 'territory.accordion.tableTitleAreas'
}

export function MainContent({
  mapOverlay,
  children,
  level,
  breadcrumb,
  onLoadRegions,
  onNavigateTo,
  showGreenTableAccordion,
  greenAreasLayerActive,
  greenAssetsLayerActive,
  areasTableQuery,
  assetsTableQuery,
  greenAssetsLayerLoading = false,
  onOpenGreenDetail,
}: MainContentProps) {
  const { t } = useTranslation()
  const panel = useGreenTablePanelOptional()
  const setMapTableAccordionVisible = panel?.setMapTableAccordionVisible
  const mapTableAccordionVisible = panel?.mapTableAccordionVisible
  const [accordionOpen, setAccordionOpen] = useState('')
  const accordionTitle = t(accordionTitleKey(greenAreasLayerActive, greenAssetsLayerActive))
  const prevExternalVisibleRef = useRef(mapTableAccordionVisible)

  const toggleAccordion = useCallback((id: string) => {
    setAccordionOpen((prev) => (prev === id ? '' : id))
  }, [])

  // Keep context in sync with local open state (for detail-modal collapse, etc.).
  useEffect(() => {
    setMapTableAccordionVisible?.(accordionOpen === 'green-data')
  }, [accordionOpen, setMapTableAccordionVisible])

  useEffect(() => {
    if (!showGreenTableAccordion) {
      setAccordionOpen('')
    }
  }, [showGreenTableAccordion])

  // External close only (e.g. detail modal): collapse on true → false, not on initial false.
  useEffect(() => {
    const prev = prevExternalVisibleRef.current
    prevExternalVisibleRef.current = mapTableAccordionVisible
    if (prev === true && mapTableAccordionVisible === false && accordionOpen === 'green-data') {
      setAccordionOpen('')
    }
  }, [mapTableAccordionVisible, accordionOpen])

  return (
    <Box as="div" display="flex" flexDirection="column" style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
      <MapBreadcrumbs
        level={level}
        breadcrumb={breadcrumb}
        onLoadRegions={onLoadRegions}
        onNavigateTo={onNavigateTo}
      />
      <Box
        as="div"
        style={{
          position: 'relative',
          flex: 1,
          minHeight: 0,
          minWidth: 0,
        }}
      >
        <Box
          as="div"
          style={{
            position: 'absolute',
            inset: 0,
            minWidth: 0,
          }}
        >
          <Box
            as="div"
            style={{
              width: '100%',
              height: '100%',
              position: 'absolute',
              inset: 0,
              minHeight: 0,
            }}
          >
            {mapOverlay}
            {children}
            {greenAssetsLayerLoading && <LoadingOverlay />}
          </Box>
        </Box>
        {showGreenTableAccordion && (
          <Accordion
            className="accordion-detail-results"
            toggle={toggleAccordion}
            open={accordionOpen}
            style={{
              position: 'absolute',
              bottom: 0,
              // Clear floating Geoinsight toolbar (~48px + 0.75rem inset) + gap
              left: 'calc(48px + 1.5rem)',
              right: '1rem',
              backgroundColor: 'white',
              zIndex: MAP_UI_OVERLAY_Z_INDEX,
            }}
          >
            <AccordionItem
              targetId="green-data"
              style={{ backgroundColor: 'white', border: '1px solid var(--gray-100)' }}
            >
              <AccordionHeader
                targetId="green-data"
                labelShowMore={t('territory.accordion.showMore')}
                labelShowLess={t('territory.accordion.showLess')}
              >
                <Text as="span" color="primary">
                  {accordionTitle}
                </Text>
              </AccordionHeader>
              <AccordionBody
                accordionId="green-data"
                className="scrollable-container"
                style={{
                  width: '100%',
                  minWidth: 0,
                  maxHeight: '420px',
                  backgroundColor: 'white',
                }}
              >
                <GreenDataTable
                  areasActive={greenAreasLayerActive}
                  assetsActive={greenAssetsLayerActive}
                  areasTableQuery={areasTableQuery}
                  assetsTableQuery={assetsTableQuery}
                  onOpenDetail={onOpenGreenDetail}
                />
              </AccordionBody>
            </AccordionItem>
          </Accordion>
        )}
      </Box>
    </Box>
  )
}
