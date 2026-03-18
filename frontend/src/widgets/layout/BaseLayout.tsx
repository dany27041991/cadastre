/**
 * Main shell using dxc-webkit grid: Box, Row, Col (no custom CSS).
 * Sidebar, optional InfoPanel, main (breadcrumb + content); collapsing sidebar narrows sidebar column and widens main.
 */
import type { ReactNode } from 'react'
import { Box, Row, Col } from 'dxc-webkit'

const INFO_PANEL_WIDTH = '22rem'

export interface BaseLayoutProps {
  readonly sidebar: ReactNode
  readonly breadcrumb: ReactNode
  readonly children: ReactNode
  readonly infoPanel?: ReactNode
  readonly isSidebarCollapsed?: boolean
}

export function BaseLayout({ sidebar, breadcrumb, children, infoPanel, isSidebarCollapsed = false }: BaseLayoutProps) {
  const sidebarCols = isSidebarCollapsed ? '1' : '2'
  const mainCols = isSidebarCollapsed ? '11' : '10'

  return (
    <Box
      as="div"
      display="flex"
      style={{ height: '100%', minHeight: '100vh', overflow: 'hidden' }}
    >
      <Row
        align="stretch"
        className="g-0"
        style={{
          width: '100%',
          height: '100%',
          margin: 0,
          flex: 1,
          minWidth: 0,
          flexWrap: infoPanel ? 'nowrap' : undefined,
        }}
      >
        <Col
          xs={sidebarCols}
          md={sidebarCols}
          lg={sidebarCols}
          style={{
            height: '100%',
            position: 'relative',
            zIndex: 2,
            flexShrink: 0,
            paddingLeft: 0,
            paddingRight: 0,
          }}
        >
          {sidebar}
        </Col>
        {infoPanel != null && (
          <Col
            style={{
              width: INFO_PANEL_WIDTH,
              minWidth: INFO_PANEL_WIDTH,
              maxWidth: INFO_PANEL_WIDTH,
              height: '100%',
              flexShrink: 0,
              paddingLeft: 0,
              paddingRight: 0,
              overflow: 'hidden',
            }}
          >
            {infoPanel}
          </Col>
        )}
        <Col
          xs={mainCols}
          md={mainCols}
          lg={mainCols}
          display="flex"
          flexDirection="column"
          style={{
            flex: infoPanel ? '1 1 0' : undefined,
            minWidth: 0,
            overflow: 'hidden',
            paddingLeft: 0,
            paddingRight: 0,
          }}
        >
          <Box
            as="main"
            display="flex"
            flexDirection="column"
            style={{ flex: 1, minWidth: 0, minHeight: 0, overflow: 'hidden' }}
          >
            <Box
              as="header"
              aria-label="Breadcrumb"
              style={{ flexShrink: 0 }}
            >
              {breadcrumb}
            </Box>
            <Box
              as="div"
              display="flex"
              flexDirection="column"
              padding="0"
              style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}
            >
              {children}
            </Box>
          </Box>
        </Col>
      </Row>
    </Box>
  )
}
