/**
 * Main shell using dxc-webkit layout primitives.
 * Sidebar width follows cu1.5-fe (85px collapsed / 330px expanded); InfoPanel uses
 * its default horizontal sizing (no forced rem width); main fills the rest.
 */
import type { ReactNode } from 'react'
import { Box } from 'dxc-webkit'

/** Match cu1.5-fe shared/components/sidebar/Sidebar.tsx */
const SIDEBAR_WIDTH_EXPANDED = '330px'
const SIDEBAR_WIDTH_COLLAPSED = '85px'

export interface BaseLayoutProps {
  readonly sidebar: ReactNode
  readonly breadcrumb: ReactNode
  readonly children: ReactNode
  readonly infoPanel?: ReactNode
  readonly isSidebarCollapsed?: boolean
}

export function BaseLayout({
  sidebar,
  breadcrumb,
  children,
  infoPanel,
  isSidebarCollapsed = false,
}: BaseLayoutProps) {
  const sidebarWidth = isSidebarCollapsed ? SIDEBAR_WIDTH_COLLAPSED : SIDEBAR_WIDTH_EXPANDED

  return (
    <Box
      as="div"
      display="flex"
      style={{ height: '100%', minHeight: '100vh', overflow: 'hidden' }}
    >
      <Box
        as="div"
        display="flex"
        style={{
          width: '100%',
          height: '100%',
          flex: 1,
          minWidth: 0,
          overflow: 'hidden',
        }}
      >
        <Box
          as="aside"
          style={{
            width: sidebarWidth,
            minWidth: sidebarWidth,
            maxWidth: sidebarWidth,
            height: '100%',
            position: 'relative',
            zIndex: 2,
            flexShrink: 0,
            overflow: 'hidden',
          }}
        >
          {sidebar}
        </Box>
        {infoPanel != null && (
          <Box
            as="div"
            className="cadastre-info-panel-host"
            style={{
              height: '100%',
              flexShrink: 0,
              overflow: 'hidden',
            }}
          >
            {infoPanel}
          </Box>
        )}
        <Box
          as="div"
          display="flex"
          flexDirection="column"
          style={{
            flex: '1 1 0',
            minWidth: 0,
            overflow: 'hidden',
          }}
        >
          <Box
            as="main"
            display="flex"
            flexDirection="column"
            style={{ flex: 1, minWidth: 0, minHeight: 0, overflow: 'hidden' }}
          >
            <Box as="header" aria-label="Breadcrumb" style={{ flexShrink: 0 }}>
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
        </Box>
      </Box>
    </Box>
  )
}
