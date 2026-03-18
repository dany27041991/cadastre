/**
 * Main content: territory breadcrumb, map, and accordion with live green areas/assets table.
 */
import { useState, useCallback, type ReactNode, type RefObject } from 'react'
import { useTranslation } from 'react-i18next'
import { Box, Accordion, AccordionItem, AccordionHeader, AccordionBody } from 'dxc-webkit'
import { MapBreadcrumbs, type MapBreadcrumbsProps } from '@/features/territory'
import { GreenDataTable } from '@/features/territory/ui/green-data-table/GreenDataTable'

export interface MainContentProps extends MapBreadcrumbsProps {
  readonly mapRef: RefObject<HTMLDivElement | null>
  readonly children: ReactNode
  /** Whether the green data table accordion is visible (drill-down flow). */
  readonly showGreenTableAccordion: boolean
  readonly greenAssetsLayerActive: boolean
  readonly areasTableQuery: string | null
  readonly assetsTableQuery: string | null
}

export function MainContent({
  mapRef,
  children,
  level,
  breadcrumb,
  onLoadRegions,
  onNavigateTo,
  showGreenTableAccordion,
  greenAssetsLayerActive,
  areasTableQuery,
  assetsTableQuery,
}: MainContentProps) {
  const { t } = useTranslation()
  const [accordionOpen, setAccordionOpen] = useState('')
  const accordionTitle = greenAssetsLayerActive
    ? t('territory.accordion.tableTitleTrees')
    : t('territory.accordion.tableTitleAreas')

  const toggleAccordion = useCallback((id: string) => {
    setAccordionOpen((prev) => (prev === id ? '' : id))
  }, [])

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
          <div
            ref={mapRef as RefObject<HTMLDivElement>}
            style={{ width: '100%', height: '100%', position: 'absolute', inset: 0 }}
          >
            {children}
          </div>
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
              zIndex: 10,
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
