/**
 * Reusable loading block: shared Spinner (dxc-webkit Loader) + optional label.
 */
import type { FC, CSSProperties } from 'react'
import { Box, Text } from 'dxc-webkit'
import { Spinner, type SpinnerSize } from '../ui-components'

export type LoadingStateProps = {
  readonly size?: SpinnerSize
  readonly label?: string
  readonly ariaLabel?: string
  readonly style?: CSSProperties
  readonly className?: string
}

export const LoadingState: FC<LoadingStateProps> = ({
  size = 'l',
  label,
  ariaLabel,
  style,
  className,
}) => (
  <Box
    as="div"
    className={className}
    display="flex"
    flexDirection="column"
    align="center"
    justify="center"
    style={{ gap: '0.75rem', ...style }}
    aria-live="polite"
    aria-busy="true"
  >
    <Spinner size={size} ariaLabel={ariaLabel ?? label ?? 'Caricamento'} />
    {label ? (
      <Text font="f1-body-sm" style={{ fontWeight: 600, color: 'var(--success)' }}>
        {label}
      </Text>
    ) : null}
  </Box>
)
