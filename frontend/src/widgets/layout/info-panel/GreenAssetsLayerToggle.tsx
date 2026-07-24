/**
 * InfoPanel toggle: switch between green areas and green assets on the map.
 */
import { useTranslation } from 'react-i18next'
import { Toggle } from 'dxc-webkit'
import { useGreenTablePanelOptional } from '@/features/territory/context/GreenTablePanelContext'

export function GreenAssetsLayerToggle() {
  const { t } = useTranslation()
  const panel = useGreenTablePanelOptional()
  const layer = panel?.greenAssetsLayer

  if (layer == null) {
    return null
  }

  const label = layer.active
    ? t('territory.panel.greenAssetsToggle')
    : t('territory.panel.managedAreasToggle')

  return (
    <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1.25rem' }}>
      <Toggle
        name="green-assets-layer"
        label={label}
        checked={layer.active}
        disabled={!layer.available || layer.loading}
        right
        onChange={(value) => {
          void layer.setActive(value)
        }}
      />
    </div>
  )
}
