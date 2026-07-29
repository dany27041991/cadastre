/**
 * InfoPanel wizard: Monitoraggio → Aree gestite / Assets Verdi.
 * Monitoraggio: no footer (entry via Area Italia click).
 * Layers: Indietro + Avanti; Indietro returns to Monitoraggio.
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Box, InfoPanel } from 'dxc-webkit'
import { LayersPanel } from './LayersPanel'
import { MonitoraggioPanel, type MonitoraggioActionId } from './MonitoraggioPanel'

type PanelStep = 'monitoraggio' | 'layers'

const AREA_ITALIA: MonitoraggioActionId = 'area-italia'

export function InfoPanelContent() {
  const { t } = useTranslation()
  const [step, setStep] = useState<PanelStep>('monitoraggio')
  const [selectedId, setSelectedId] = useState<MonitoraggioActionId | null>(null)

  const goToLayers = () => setStep('layers')
  const goToMonitoraggio = () => setStep('monitoraggio')

  const handleMonitoraggioSelect = (id: MonitoraggioActionId) => {
    setSelectedId(id)
    if (id === AREA_ITALIA) {
      goToLayers()
    }
    // TODO: wire draw / upload / search actions when available
  }

  if (step === 'monitoraggio') {
    return (
      <Box
        as="div"
        style={{
          height: '100%',
          background: 'white',
          overflow: 'auto',
          boxSizing: 'border-box',
        }}
      >
        <InfoPanel optionSearchBar={[]} searchText={undefined} hideSearch hideFooter>
          <MonitoraggioPanel
            selectedId={selectedId}
            onSelect={handleMonitoraggioSelect}
            onClearSelection={() => setSelectedId(null)}
          />
        </InfoPanel>
      </Box>
    )
  }

  return (
    <Box
      as="div"
      style={{
        height: '100%',
        background: 'white',
        overflow: 'auto',
        boxSizing: 'border-box',
      }}
    >
      <InfoPanel
        optionSearchBar={[]}
        textBtnPre={t('territory.panel.btnBack')}
        textBtnNew={t('territory.panel.btnForward')}
        onClickBtnPre={goToMonitoraggio}
        onClickBtnNew={() => {
          // TODO: next wizard step after layers (not in v1 scope)
        }}
        arrowBtnNew
        arrowBtnPre
        searchText={undefined}
        hideSearch
      >
        <LayersPanel />
      </InfoPanel>
    </Box>
  )
}
