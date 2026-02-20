/**
 * Breadcrumb navigation above the content. Traversable and clickable.
 */
import type { TerritoryLevel, BreadcrumbCrumb } from '@/shared/types/territory'
import styles from './MapBreadcrumbs.module.css'

export interface MapBreadcrumbsProps {
  level: TerritoryLevel
  breadcrumb: BreadcrumbCrumb[]
  onLoadRegions: () => void
  onNavigateTo: (index: number) => void
}

export function MapBreadcrumbs({
  level,
  breadcrumb,
  onLoadRegions,
  onNavigateTo,
}: MapBreadcrumbsProps) {
  return (
    <nav className={styles.breadcrumbs} aria-label="Territory navigation">
      <button
        type="button"
        className={`${styles.link} ${level === 'regions' ? styles.linkActive : ''}`}
        onClick={onLoadRegions}
      >
        Italia
      </button>
      {breadcrumb.map((b, i) => (
        <span key={i} className={styles.item}>
          <span className={styles.separator}>/</span>
          <button
            type="button"
            className={`${styles.link} ${i === breadcrumb.length - 1 ? styles.linkActive : ''}`}
            onClick={() => onNavigateTo(i)}
          >
            {b.label}
          </button>
        </span>
      ))}
    </nav>
  )
}
