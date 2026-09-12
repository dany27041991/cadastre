/**
 * Dual-mode drill header: back to areas list while viewing area assets.
 */
import type { FC } from 'react'
import { useTranslation } from 'react-i18next'
import { BackNavHeader } from '@/shared/ui'

export type GreenTableDrillHeaderProps = {
  areaLabel: string | null | undefined
  onBack: () => void
}

export const GreenTableDrillHeader: FC<GreenTableDrillHeaderProps> = ({
  areaLabel,
  onBack,
}) => {
  const { t } = useTranslation()
  return (
    <BackNavHeader
      backLabel={t('territory.table.backToAreas')}
      onBack={onBack}
      titleLabel={t('territory.table.managedAreaNameLabel')}
      title={areaLabel}
      hint={t('territory.table.drillAreaAssetsHint')}
    />
  )
}
