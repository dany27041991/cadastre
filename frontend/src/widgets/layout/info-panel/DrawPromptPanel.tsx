/**
 * Draw step — same InfoPanel header style as Layers (Text + Line).
 * Instructs the user to use Geoinsight simpledraw (closed shapes only).
 */
import { useTranslation } from 'react-i18next'
import { Text } from 'dxc-webkit'
import { Line } from '@/shared/ui'
import { GreenLayerToggles } from './GreenAssetsLayerToggle'

export function DrawPromptPanel() {
  const { t } = useTranslation()

  return (
    <div className="mb-5">
      <Text
        font="f1-style-h1-bold"
        style={{ fontSize: '20px', fontWeight: 600 }}
        className="mt-1"
        color="text-primary"
      >
        {t('territory.panel.draw.title')}
      </Text>
      <Line />
      <Text as="p" font="f1-body-sm" color="text-body" style={{ marginTop: '0.75rem' }}>
        {t('territory.panel.draw.description')}
      </Text>
      <div style={{ marginTop: '1rem' }}>
        <GreenLayerToggles locked />
      </div>
    </div>
  )
}
