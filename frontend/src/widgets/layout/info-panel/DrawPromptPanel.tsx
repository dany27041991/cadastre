/**
 * Draw step — instruct Geoinsight simpledraw; ingest dates required before toggles.
 * Toggles stay locked until the user closes a draw geometry (spatialClip).
 */
import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Text } from 'dxc-webkit'
import { Line } from '@/shared/ui'
import { useGreenTablePanelOptional } from '@/features/territory/context/GreenTablePanelContext'
import { GreenLayerToggles } from './GreenAssetsLayerToggle'
import { IngestDateRangeFields } from './IngestDateRangeFields'

export function DrawPromptPanel() {
  const { t } = useTranslation()
  const panel = useGreenTablePanelOptional()
  const rangeReady = panel?.hasIngestDateRange === true
  const layer = panel?.greenAssetsLayer

  useEffect(() => {
    if (rangeReady || layer == null) return
    if (layer.active) void layer.setActive(false)
    if (layer.areasActive) void layer.setAreasActive(false)
  }, [rangeReady, layer?.active, layer?.areasActive, layer?.setActive, layer?.setAreasActive])

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

      <IngestDateRangeFields />

      {rangeReady ? (
        <div style={{ marginTop: '1rem' }}>
          <GreenLayerToggles />
        </div>
      ) : null}
    </div>
  )
}
