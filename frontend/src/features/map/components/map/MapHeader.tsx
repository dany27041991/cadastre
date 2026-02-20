/**
 * Header with territory navigation breadcrumb.
 */
import type { MapHeaderProps } from '@/features/map/types/interfaces/mapComponents.interfaces'
import styles from './MapHeader.module.css'

export type { MapHeaderProps } from '@/features/map/types/interfaces/mapComponents.interfaces'

export function MapHeader({
  level,
  breadcrumb,
  loading,
  onLoadRegions,
  onNavigateTo,
  onGoBack,
}: MapHeaderProps) {
  return (
    <header className={styles.header}>
      <span>Tree Cadastre</span>
      <nav className={styles.nav}>
        <button
          type="button"
          className={`${styles.button} ${level === 'regions' ? styles.buttonActive : ''}`}
          onClick={onLoadRegions}
        >
          Italia
        </button>
        {breadcrumb.map((b, i) => (
          <span key={i} className={styles.breadcrumbItem}>
            <span className={styles.separator}>/</span>
            <button
              type="button"
              className={`${styles.button} ${i === breadcrumb.length - 1 ? styles.buttonActive : ''}`}
              onClick={() => onNavigateTo(i)}
            >
              {b.label}
            </button>
          </span>
        ))}
        {breadcrumb.length > 0 && (
          <button
            type="button"
            className={`${styles.button} ${styles.backButton}`}
            onClick={onGoBack}
          >
            ← Back
          </button>
        )}
      </nav>
      {loading && <span className={styles.loading}>Loading...</span>}
    </header>
  )
}
