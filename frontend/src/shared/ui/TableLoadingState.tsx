/**
 * Table loading indicator — dxc-webkit Spinner grow (primary/blue), distinct
 * from the green circle Loader used on the map overlay.
 * @see docs/components/dxc-webkit/46-spinner.md
 * @see docs/components/shared-ui-components.md
 */
import { useEffect, useRef, type FC, type CSSProperties } from 'react'
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
  // #region agent log
  useEffect(() => {
    const el = rootRef.current
    const dots = el?.querySelectorAll('.spinner-grow')
    const rect = el?.getBoundingClientRect()
    const cs = dots?.[0] ? getComputedStyle(dots[0]) : null
    fetch('http://127.0.0.1:7455/ingest/ee4d7135-3aef-4e11-b07a-3de89c3bf62c', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Debug-Session-Id': '4fe799',
      },
      body: JSON.stringify({
        sessionId: '4fe799',
        runId: 'perf',
        hypothesisId: 'H-table-loader-vis',
        location: 'TableLoadingState.tsx:mount',
        message: 'table_blue_dots_loader_shown',
        data: {
          label: label ?? null,
          nGrow: dots?.length ?? 0,
          w: rect ? Math.round(rect.width) : null,
          h: rect ? Math.round(rect.height) : null,
          bg: cs?.backgroundColor ?? null,
          color: cs?.color ?? null,
          anim: cs?.animationName ?? null,
        },
        timestamp: Date.now(),
      }),
    }).catch(() => {})
  }, [label])
  // #endregion

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
