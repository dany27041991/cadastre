/**
 * Main content: territory breadcrumb, map, and accordion with live green areas/assets table.
 */
import { useState, useCallback, useEffect, type ReactNode } from 'react'
import { MAP_UI_OVERLAY_Z_INDEX } from '@/features/territory-map-geoinsight/ui/geoinsightMapStyle'
import { useTranslation } from 'react-i18next'
import { Box, Accordion, AccordionItem, AccordionHeader, AccordionBody } from 'dxc-webkit'
import { MapBreadcrumbs, type MapBreadcrumbsProps } from '@/features/territory'
import { GreenDataTable } from '@/features/territory/ui/green-data-table/GreenDataTable'
import { LoadingOverlay } from '@/features/territory/ui/loading-overlay/LoadingOverlay'
import { useGreenTablePanelOptional } from '@/features/territory/context/GreenTablePanelContext'

export interface MainContentProps extends MapBreadcrumbsProps {
  /** Geoinsight map slot. */
  readonly mapOverlay: ReactNode
  readonly children?: ReactNode
  /** Whether the green data table accordion is visible (drill-down flow). */
  readonly showGreenTableAccordion: boolean
  readonly greenAssetsLayerActive: boolean
  readonly areasTableQuery: string | null
  readonly assetsTableQuery: string | null
  readonly greenAssetsLayerLoading?: boolean
}

export function MainContent({
  mapOverlay,
  children,
  level,
  breadcrumb,
  onLoadRegions,
  onNavigateTo,
  showGreenTableAccordion,
  greenAssetsLayerActive,
  areasTableQuery,
  assetsTableQuery,
  greenAssetsLayerLoading = false,
}: MainContentProps) {
  const { t } = useTranslation()
  const panel = useGreenTablePanelOptional()
  const [accordionOpen, setAccordionOpen] = useState('')
  const accordionTitle = greenAssetsLayerActive
    ? t('territory.accordion.tableTitleTrees')
    : t('territory.accordion.tableTitleAreas')

  const toggleAccordion = useCallback(
    (id: string) => {
      setAccordionOpen((prev) => {
        const next = prev === id ? '' : id
        panel?.setMapTableAccordionVisible(next === id)
        return next
      })
    },
    [panel]
  )

  useEffect(() => {
    if (!showGreenTableAccordion) {
      setAccordionOpen('')
      panel?.setMapTableAccordionVisible(false)
    }
  }, [showGreenTableAccordion, panel])

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
          border="border"
          borderColor="primary"
          borderThickness={3}
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
              left: '1rem',
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
                <span style={{ color: 'var(--primary)' }}>{accordionTitle}</span>
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
                  showGreenAssets={greenAssetsLayerActive}
                  areasTableQuery={areasTableQuery}
                  assetsTableQuery={assetsTableQuery}
                />
              </AccordionBody>
            </AccordionItem>
          </Accordion>
        )}
      </Box>
    </Box>
  )
}
