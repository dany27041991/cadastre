/**
 * Layout wrapper: sidebar + main content area (map, tables with filters, etc.).
 */
import type { ReactNode, RefObject } from 'react'
import { Sidebar } from '../sidebar/Sidebar'
import { MapBreadcrumbs, type MapBreadcrumbsProps } from '@/features/territory'
import styles from './MainContent.module.css'

export interface MainContentProps extends MapBreadcrumbsProps {
  readonly mapRef: RefObject<HTMLDivElement | null>
  readonly children: ReactNode
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
        <div ref={mapRef as RefObject<HTMLDivElement>} className={styles.contentArea}>
          {children}
        </div>
      </div>
    </div>
  )
}
