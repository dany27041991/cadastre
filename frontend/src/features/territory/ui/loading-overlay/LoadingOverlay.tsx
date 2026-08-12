/**
 * Overlay shown while the green layer is loading.
 * Uses shared LoadingState (dxc-webkit Loader via Spinner).
 */
import { useTranslation } from 'react-i18next'
import { LoadingState } from '@/shared/ui'
import { I18N_KEYS } from '../../model/constants'
import styles from './LoadingOverlay.module.css'

export function LoadingOverlay() {
  const { t } = useTranslation()
  const label = t(I18N_KEYS.loading)
  return (
    <output
      className={styles.overlay}
      aria-live="polite"
      aria-label={t(I18N_KEYS.loadingGreenLayer)}
    >
      <LoadingState size="l" label={label} ariaLabel={label} />
    </output>
  )
}
