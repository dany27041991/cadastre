/**
 * Layers step — same InfoPanel header style as cu1.5 (Text + Line).
 */
import { useTranslation } from 'react-i18next'
import { Text } from 'dxc-webkit'
import { Line } from '@/shared/ui'
import { useGreenTablePanelOptional } from '@/features/territory/context/GreenTablePanelContext'
import { GreenLayerToggles } from './GreenAssetsLayerToggle'
import { TerritorySearchInput } from './TerritorySearchInput'

export function LayersPanel() {
  const { t } = useTranslation()
  const entryMode = useGreenTablePanelOptional()?.entryMode ?? 'admin'

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
        {t(
          entryMode === 'draw'
            ? 'territory.panel.layersDescriptionDraw'
            : 'territory.panel.layersDescription'
        )}
      </Text>

      {entryMode === 'admin' ? (
        <div style={{ marginTop: '1rem' }}>
          <TerritorySearchInput />
        </div>
      ) : null}

      <div style={{ marginTop: '1rem' }}>
        <GreenLayerToggles />
      </div>
    </div>
  )
}
