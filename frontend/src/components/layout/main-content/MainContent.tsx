/**
 * Layout wrapper: sidebar + main content area (map, tables with filters, etc.).
 */
import type { ReactNode, RefObject } from 'react'
import { Sidebar } from '@/components/layout/sidebar/Sidebar'
import {
  MapBreadcrumbs,
  type MapBreadcrumbsProps,
} from '@/components/layout/main-content/map-breadcrumbs/MapBreadcrumbs'
import styles from './MainContent.module.css'

export interface MainContentProps extends MapBreadcrumbsProps {
  mapRef: RefObject<HTMLDivElement | null>
  children: ReactNode
}

export function MainContent({
  mapRef,
  children,
  level,
  breadcrumb,
  onLoadRegions,
  onNavigateTo,
}: MainContentProps) {
  return (
    <div className={styles.mainContent}>
      <Sidebar />
      <div className={styles.contentSection}>
        <MapBreadcrumbs
          level={level}
          breadcrumb={breadcrumb}
          onLoadRegions={onLoadRegions}
          onNavigateTo={onNavigateTo}
        />
        <div ref={mapRef} className={styles.contentArea}>
          {children}
        </div>
      </div>
    </div>
  )
}
