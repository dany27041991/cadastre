/**
 * Compact back-navigation header (dxc-webkit Chip + Text).
 * Used e.g. when drilling from managed areas table into area assets.
 */
import type { FC, CSSProperties } from 'react'
import { Box, Chip, Text, icons } from 'dxc-webkit'
import styles from './BackNavHeader.module.css'

export type BackNavHeaderProps = {
  readonly backLabel: string
  readonly onBack: () => void
  /** Optional label shown before the title, e.g. "Nome area gestita". */
  readonly titleLabel?: string | null
  readonly title?: string | null
  readonly hint?: string | null
  readonly style?: CSSProperties
  readonly className?: string
}

export const BackNavHeader: FC<BackNavHeaderProps> = ({
  backLabel,
  onBack,
  titleLabel,
  title,
  hint,
  style,
  className,
}) => (
  <Box
    as="div"
    className={[styles.root, className].filter(Boolean).join(' ')}
    style={style}
  >
    <Box as="div" className={styles.nav}>
      <Chip
        size="sm"
        color="primary"
        isOutlined
        IconLeft={icons.ArrowLeftIcon}
        onClick={onBack}
        style={{ cursor: 'pointer' }}
      >
        {backLabel}
      </Chip>
    </Box>
    {title ? (
      <Text as="p" font="f1-body-md" className={styles.title}>
        {titleLabel ? (
          <>
            <Text as="span" font="f1-body-md" style={{ fontWeight: 600 }}>
              {titleLabel}:{' '}
            </Text>
            {title}
          </>
        ) : (
          title
        )}
      </Text>
    ) : null}
    {hint ? (
      <Text as="p" font="f1-body-sm" className={styles.hint}>
        {hint}
      </Text>
    ) : null}
  </Box>
)
