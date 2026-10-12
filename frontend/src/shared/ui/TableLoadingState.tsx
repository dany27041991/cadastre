/**
 * Table loading indicator — dxc-webkit Spinner grow (primary/blue), distinct
 * from the green circle Loader used on the map overlay.
 * @see docs/components/dxc-webkit/46-spinner.md
 * @see docs/components/shared-ui-components.md
 */
import { useRef, type FC, type CSSProperties } from 'react'
import { Box, Spinner, Text } from 'dxc-webkit'

export type TableLoadingStateProps = {
  readonly label?: string
  readonly ariaLabel?: string
  readonly style?: CSSProperties
  readonly className?: string
}

export const TableLoadingState: FC<TableLoadingStateProps> = ({
  label,
  ariaLabel,
  style,
  className,
}) => {
  const rootRef = useRef<HTMLDivElement | null>(null)

  return (
    <div
      ref={rootRef}
      className={className}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '0.75rem',
        minHeight: '4rem',
        ...style,
      }}
      aria-live="polite"
      aria-busy="true"
      aria-label={ariaLabel ?? label ?? 'Caricamento tabella'}
    >
      <Box as="div" className="table-dots-loader" display="flex" align="center">
        <Spinner type="grow" color="primary" size="sm" />
        <Spinner type="grow" color="primary" size="sm" />
        <Spinner type="grow" color="primary" size="sm" />
      </Box>
      {label ? (
        <Text font="f1-body-sm" style={{ fontWeight: 600, color: 'var(--primary)' }}>
          {label}
        </Text>
      ) : null}
    </div>
  )
}
