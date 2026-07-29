/**
 * InfoPanel toggles: Aree Gestite + Assets Verdi (dxc-webkit Toggle + helperText).
 */
import { useTranslation } from 'react-i18next'
import { Box, Toggle } from 'dxc-webkit'
import { useGreenTablePanelOptional } from '@/features/territory/context/GreenTablePanelContext'

export function GreenLayerToggles() {
  const { t } = useTranslation()
  const panel = useGreenTablePanelOptional()
  const layer = panel?.greenAssetsLayer

  if (layer == null) {
    return null
  }

  const disabled = !layer.available || layer.loading

  return (
    <Box as="div" className="d-flex flex-column gap-4" style={{ marginBottom: '1.25rem' }}>
      <Toggle
        name="green-areas-layer"
        label={t('territory.panel.managedAreasToggle')}
        helperText={t('territory.panel.managedAreasToggleHelp')}
        checked={layer.areasActive}
        disabled={disabled}
        right
        onChange={(value) => {
          void layer.setAreasActive(value)
        }}
      />
      <Toggle
        name="green-assets-layer"
        label={t('territory.panel.greenAssetsToggle')}
        helperText={t('territory.panel.greenAssetsToggleHelp')}
        checked={layer.active}
        disabled={disabled}
        right
        onChange={(value) => {
          void layer.setActive(value)
        }}
      />
    </Box>
  )
}

/** @deprecated Use GreenLayerToggles — kept for import compatibility. */
export { GreenLayerToggles as GreenAssetsLayerToggle }
