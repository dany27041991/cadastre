/**
 * Overlay shown while the green layer is loading.
 */
import styles from './LoadingOverlay.module.css'

export function LoadingOverlay() {
  return (
    <div
      className={styles.overlay}
      role="status"
      aria-live="polite"
      aria-label="Loading green layer"
    >
      <div className={styles.spinner} />
      <span className={styles.label}>Loading green...</span>
    </div>
  )
}
