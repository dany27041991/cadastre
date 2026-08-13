/**
 * Layers step — same InfoPanel header style as cu1.5 (Text + Line).
 */
import { useTranslation } from 'react-i18next'
import { Text } from 'dxc-webkit'
import { Line } from '@/shared/ui'
import { GreenLayerToggles } from './GreenAssetsLayerToggle'
import { TerritorySearchInput } from './TerritorySearchInput'

export function LayersPanel() {
  const { t } = useTranslation()

  return (
    <div className="mb-5">
      <Text
        font="f1-style-h1-bold"
        style={{ fontSize: '20px', fontWeight: 600 }}
        className="mt-1"
        color="text-primary"
      >
        {t('territory.panel.layersTitle')}
      </Text>
      <Line />
      <Text as="p" font="f1-body-sm" color="text-body" style={{ marginTop: '0.75rem' }}>
        {t('territory.panel.layersDescription')}
      </Text>

      <div style={{ marginTop: '1rem' }}>
        <TerritorySearchInput />
      </div>

      <div style={{ marginTop: '1rem' }}>
        <GreenLayerToggles />
      </div>
    </div>
  )
}
