/**
 * Breadcrumb navigation above the content. Traversable and clickable.
 */
import { useTranslation } from 'react-i18next'
import type { MapBreadcrumbsProps } from '../../types'
import { I18N_KEYS } from '../../model/constants'
import styles from './MapBreadcrumbs.module.css'

export function MapBreadcrumbs({
  level,
  breadcrumb,
  onLoadRegions,
  onNavigateTo,
}: MapBreadcrumbsProps) {
  const { t } = useTranslation()
  return (
    <nav className={styles.breadcrumbs} aria-label={t(I18N_KEYS.navigationAria)}>
      <button
        type="button"
        className={`${styles.link} ${level === 'regions' ? styles.linkActive : ''}`}
        onClick={onLoadRegions}
      >
        {t(I18N_KEYS.italia)}
      </button>
      {breadcrumb.map((b, i) => {
        const isNavigable = b.navigable === undefined || b.navigable === true
        const isLast = i === breadcrumb.length - 1
        return (
        <span key={`crumb-${i}-${b.level}-${b.id}`} className={styles.item}>
          <span className={styles.separator}>/</span>
          {isNavigable ? (
            <button
              type="button"
              className={`${styles.link} ${isLast ? styles.linkActive : ''}`}
              onClick={() => onNavigateTo(i)}
            >
              {b.label}
            </button>
          ) : (
            <span
              className={`${styles.link} ${styles.linkDisabled} ${isLast ? styles.linkActive : ''}`}
              aria-current="location"
            >
              {b.label}
            </span>
          )}
        </span>
        )
      })}
    </nav>
  )
}
