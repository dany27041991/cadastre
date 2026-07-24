/**
 * Overlay shown while the green layer is loading.
 */
import { useTranslation } from 'react-i18next'
import { Loader, Text } from 'dxc-webkit'
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
      <Loader
        type="circle"
        size="lg"
        value={50}
        showPercentage={false}
        className="green-circle-loader"
      />
      <Text font="f1-body-md" style={{ fontWeight: 600, color: 'var(--success)' }}>
        {t(I18N_KEYS.loading)}
      </Text>
    </output>
  )
}
