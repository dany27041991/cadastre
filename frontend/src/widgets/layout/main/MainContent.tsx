/**
 * Area contenuto principale: breadcrumb territorio + mappa a schermo intero + accordion (tabella) in overlay in basso.
 * Bordo primary solo sul contenitore della mappa (dxc-webkit Box).
 */
import { useEffect, useState, useCallback, type ReactNode, type RefObject } from 'react'
import { Box, CustomTable, Accordion, AccordionItem, AccordionHeader, AccordionBody, Button, icons } from 'dxc-webkit'
import { MapBreadcrumbs, type MapBreadcrumbsProps } from '@/features/territory'

type TableRow = Record<string, string | number> & { title: string; description: string; rating?: number }

const MOCK_ROWS: TableRow[] = [
  { title: 'Particella 101', description: 'Foglio 12, mappale 001', rating: 85 },
  { title: 'Particella 102', description: 'Foglio 12, mappale 002', rating: 72 },
  { title: 'Particella 103', description: 'Foglio 12, mappale 003', rating: 90 },
  { title: 'Particella 201', description: 'Foglio 15, mappale 001', rating: 68 },
  { title: 'Particella 202', description: 'Foglio 15, mappale 002', rating: 95 },
  { title: 'Particella 301', description: 'Foglio 18, mappale 001', rating: 78 },
  { title: 'Particella 302', description: 'Foglio 18, mappale 002', rating: 82 },
  { title: 'Particella 401', description: 'Foglio 20, mappale 001', rating: 71 },
  { title: 'Particella 402', description: 'Foglio 20, mappale 002', rating: 88 },
  { title: 'Particella 501', description: 'Foglio 22, mappale 001', rating: 65 },
  { title: 'Particella 502', description: 'Foglio 22, mappale 002', rating: 91 },
  { title: 'Particella 601', description: 'Foglio 25, mappale 001', rating: 74 },
  { title: 'Particella 602', description: 'Foglio 25, mappale 002', rating: 79 },
  { title: 'Particella 701', description: 'Foglio 28, mappale 001', rating: 86 },
  { title: 'Particella 702', description: 'Foglio 28, mappale 002', rating: 93 },
  { title: 'Particella 801', description: 'Foglio 30, mappale 001', rating: 69 },
  { title: 'Particella 802', description: 'Foglio 30, mappale 002', rating: 77 },
  { title: 'Particella 901', description: 'Foglio 32, mappale 001', rating: 84 },
  { title: 'Particella 902', description: 'Foglio 32, mappale 002', rating: 92 },
  { title: 'Particella 1001', description: 'Foglio 35, mappale 001', rating: 70 },
]

function loadRows(
  page: number,
  limit?: number,
  _sort?: { field: keyof TableRow & string; sort: 'asc' | 'desc' }
): Promise<{ rows: TableRow[]; totalCount: number }> {
  const size = limit ?? 10
  const start = (page - 1) * size
  const slice = MOCK_ROWS.slice(start, start + size)
  return Promise.resolve({
    rows: slice,
    totalCount: MOCK_ROWS.length,
  })
}

export interface MainContentProps extends MapBreadcrumbsProps {
  readonly mapRef: RefObject<HTMLDivElement | null>
  readonly children: ReactNode
}

const COLUMNS = [
  { id: 'title' as const, label: 'Nome', isSortable: true },
  { id: 'description' as const, label: 'Descrizione' },
  { id: 'rating' as const, label: 'Rating', isSortable: true },
]

export function MainContent({
  mapRef,
  children,
  level,
  breadcrumb,
  onLoadRegions,
  onNavigateTo,
}: MainContentProps) {
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(5)
  const [sort, setSort] = useState<[string, 'asc' | 'desc'] | null>(null)
  const [rows, setRows] = useState<TableRow[]>([])
  const [totalCount, setTotalCount] = useState(MOCK_ROWS.length)
  const [accordionOpen, setAccordionOpen] = useState('')

  const toggleAccordion = useCallback((id: string) => {
    setAccordionOpen((prev) => (prev === id ? '' : id))
  }, [])

  const fetchRows = useCallback(() => {
    const sortParam = sort
      ? { field: sort[0] as keyof TableRow & string, sort: sort[1] }
      : undefined
    loadRows(page, pageSize, sortParam).then(({ rows: data, totalCount: total }) => {
      setRows(data)
      setTotalCount(total)
    })
  }, [page, pageSize, sort])

  useEffect(() => {
    fetchRows()
  }, [fetchRows])

  const handlePaginationChange = useCallback((newPage: number, newPageSize: number) => {
    setPage(newPage)
    setPageSize(newPageSize)
  }, [])

  const handleSort = useCallback((args: [string | number, 'asc' | 'desc'] | null) => {
    setSort(args ? [String(args[0]), args[1]] : null)
    setPage(1)
  }, [])

  const paginationOptions = [page, pageSize, totalCount]

  const actions = [
    { id: 'edit' as const, label: 'Edit', icon: icons.EditIcon, onClick: (_row: Record<string, string | number>, _index: number) => {} },
    { id: 'test' as const, label: 'Test', icon: icons.InfoCircleIcon, onClick: (_row: Record<string, string | number>, _index: number) => {} },
    { id: 'delete' as const, label: 'Delete', icon: icons.TrashIcon, onClick: (_row: Record<string, string | number>, _index: number) => {} },
  ]

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
          <AccordionItem targetId="detail" style={{ backgroundColor: 'white', border: '1px solid var(--gray-100)' }}>
            <AccordionHeader
              targetId="detail"
              labelShowMore="Mostra dettaglio"
              labelShowLess="Nascondi dettaglio"
            >
              <span style={{ color: 'var(--primary)' }}>Dettaglio risultati</span>
            </AccordionHeader>
            <AccordionBody
              accordionId="detail"
              className="scrollable-container"
              style={{
                width: '100%',
                maxHeight: '400px',
                backgroundColor: 'white',
              }}
            >
              <CustomTable
                color="primary-alternate"
                style={{ width: '100%', margin: 0 }}
                className="table-sm"
                wrapperClassName="compact-table"
                tableWrapperClassname="scrollable-container compact-table"
                headerCellClassName="f1-label-sm"
                cellClassName="f1-body-sm"
                columns={COLUMNS}
                rows={rows}
                handleSort={handleSort}
                pagination
                paginationOptions={paginationOptions}
                handlePaginationChange={handlePaginationChange}
                pageSizeOptions={[5, 10, 15, 20]}
                actions={actions}
                renderDistance={1}
                openTop
              />
              <Box as="div" padding="s" style={{ justifySelf: 'flex-end' }}>
                <Button color="primary" kind="filled" size="md" onClick={() => {}}>
                  Label text
                  <icons.VectorIcon size="xs" style={{ width: 10, height: 10, marginLeft: 10 }} />
                </Button>
              </Box>
            </AccordionBody>
          </AccordionItem>
        </Accordion>
      </Box>
    </Box>
  )
}
