/**
 * Overlay shown while the green layer is loading.
 */
import { useTranslation } from 'react-i18next'
import { Box } from 'dxc-webkit'
import { I18N_KEYS } from '../../model/constants'
import styles from './LoadingOverlay.module.css'

export function LoadingOverlay() {
  const { t } = useTranslation()
  return (
    <output
      className={styles.overlay}
      aria-live="polite"
      aria-label={t(I18N_KEYS.loadingGreenLayer)}
    >
      <Box as="div" className={styles.spinner} />
      <span className={styles.label}>{t(I18N_KEYS.loadingGreen)}</span>
    </output>
  )
}
