/**
 * Header with territory navigation breadcrumb.
 */
import { useTranslation } from 'react-i18next'
import type { MapHeaderProps } from '../../types'
import { I18N_KEYS } from '../../model/constants'
import styles from './MapHeader.module.css'

export function MapHeader({
  level,
  breadcrumb,
  loading,
  onLoadRegions,
  onNavigateTo,
  onGoBack,
}: MapHeaderProps) {
  const { t } = useTranslation()
  return (
    <header className={styles.header}>
      <span>{t(I18N_KEYS.appTitle)}</span>
      <nav className={styles.nav}>
        <button
          type="button"
          className={`${styles.button} ${level === 'regions' ? styles.buttonActive : ''}`}
          onClick={onLoadRegions}
        >
          {t(I18N_KEYS.italia)}
        </button>
        {breadcrumb.map((b, i) => (
          <span key={`crumb-${i}-${b.level}-${b.id}`} className={styles.breadcrumbItem}>
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
            {t(I18N_KEYS.back)}
          </button>
        )}
      </nav>
      {loading && <span className={styles.loading}>{t(I18N_KEYS.loading)}</span>}
    </header>
  )
}
