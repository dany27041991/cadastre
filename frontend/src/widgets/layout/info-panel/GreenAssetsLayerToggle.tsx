/**
 * InfoPanel toggles: Aree Gestite + Assets Verdi (dxc-webkit Toggle + helperText).
 */
import { useTranslation } from 'react-i18next'
import { Box, Toggle } from 'dxc-webkit'
import { useGreenTablePanelOptional } from '@/features/territory/context/GreenTablePanelContext'

export function GreenLayerToggles({ locked: lockedProp = false }: { readonly locked?: boolean } = {}) {
  const { t } = useTranslation()
  const panel = useGreenTablePanelOptional()
  const layer = panel?.greenAssetsLayer
  const areasLocked = panel?.areasToggleLockedByGreenSearch === true
  const clipLocked = panel?.entryMode === 'draw' && panel?.spatialClip == null
  const locked = lockedProp || clipLocked
  const hide = layer == null && !locked
  const disabled = locked || layer == null || !layer.available || layer.loading
  const areasDisabled = disabled || areasLocked

  if (hide) {
    return null
  }

  return (
    <Box as="div" className="d-flex flex-column gap-4" style={{ marginBottom: '1.25rem' }}>
      <Toggle
        name="green-areas-layer"
        label={t('territory.panel.managedAreasToggle')}
        helperText={
          locked
            ? t('territory.panel.draw.togglesLockedHelp')
            : t('territory.panel.managedAreasToggleHelp')
        }
        checked={locked ? false : layer?.areasActive === true || areasLocked}
        disabled={areasDisabled}
        right
        onChange={(value) => {
          if (locked || layer == null) return
          if (areasLocked && !value) {
            return
          }
          void layer.setAreasActive(value)
        }}
      />
      <Toggle
        name="green-assets-layer"
        label={t('territory.panel.greenAssetsToggle')}
        helperText={
          locked
            ? t('territory.panel.draw.togglesLockedHelp')
            : t('territory.panel.greenAssetsToggleHelp')
        }
        checked={locked ? false : layer?.active === true}
        disabled={disabled}
        right
        onChange={(value) => {
          if (locked || layer == null) return
          void layer.setActive(value)
        }}
      />
    </Box>
  )
}

/** @deprecated Use GreenLayerToggles — kept for import compatibility. */
export { GreenLayerToggles as GreenAssetsLayerToggle }
