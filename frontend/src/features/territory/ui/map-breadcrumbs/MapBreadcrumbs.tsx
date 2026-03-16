/**
 * Breadcrumb navigation above the content. Traversable and clickable.
 * Usa Chip dxc-webkit (size sm), senza CSS custom.
 */
import { useTranslation } from 'react-i18next'
import { Box, Chip, Text, icons } from 'dxc-webkit'
import type { MapBreadcrumbsProps } from '../../types'
import { I18N_KEYS } from '../../model/constants'

export function MapBreadcrumbs({
  level,
  breadcrumb,
  onLoadRegions,
  onNavigateTo,
}: MapBreadcrumbsProps) {
  const { t } = useTranslation()

  return (
    <Box
      as="nav"
      display="flex"
      justify="end"
      align="center"
      padding="s"
      style={{
        flexWrap: 'wrap',
        background: 'rgba(255, 255, 255, 0.95)',
        borderBottom: '1px solid #e0e0e0',
      }}
      aria-label={t(I18N_KEYS.navigationAria)}
    >
      <Chip
        size="sm"
        color="primary"
        isOutlined={level !== 'regions'}
        IconLeft={icons.HomeIcon}
        onClick={onLoadRegions}
        style={{ cursor: 'pointer' }}
      >
        {t(I18N_KEYS.italia)}
      </Chip>
      {breadcrumb.map((b, i) => {
        const isNavigable = b.navigable === undefined || b.navigable === true
        const isLast = i === breadcrumb.length - 1
        return (
          <Box
            as="span"
            key={`crumb-${i}-${b.level}-${b.id}`}
            display="inline-flex"
            align="center"
            {...(i > 0 ? { margin: 'xxs' as const } : {})}
          >
            <Text as="span" color="primary"></Text>
            {isNavigable ? (
              <Chip
                size="sm"
                color="primary"
                isOutlined={!isLast}
                onClick={() => onNavigateTo(i)}
                style={{ cursor: 'pointer' }}
              >
                {b.label}
              </Chip>
            ) : (
              <Chip size="sm" color="primary" isOutlined={!isLast} disabled aria-current="location">
                {b.label}
              </Chip>
            )}
          </Box>
        )
      })}
    </Box>
  )
}
