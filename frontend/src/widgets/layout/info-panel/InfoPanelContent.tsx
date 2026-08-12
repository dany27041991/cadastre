/**
 * InfoPanel wizard: Monitoraggio → Aree gestite / Assets Verdi.
 * Monitoraggio: no footer (entry via Area Italia click).
 * Layers: Indietro + Avanti; Indietro restores Italy landing + Monitoraggio.
 */
import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Box, InfoPanel } from 'dxc-webkit'
import { useGreenTablePanelOptional } from '@/features/territory/context/GreenTablePanelContext'
import { LayersPanel } from './LayersPanel'
import { MonitoraggioPanel, type MonitoraggioActionId } from './MonitoraggioPanel'

type PanelStep = 'monitoraggio' | 'layers'

const AREA_ITALIA: MonitoraggioActionId = 'area-italia'

export function InfoPanelContent() {
  const { t } = useTranslation()
  const panel = useGreenTablePanelOptional()
  const setLayersPanelOpen = panel?.setLayersPanelOpen
  const [step, setStep] = useState<PanelStep>('monitoraggio')
  const [selectedId, setSelectedId] = useState<MonitoraggioActionId | null>(null)

  useEffect(() => {
    setLayersPanelOpen?.(step === 'layers')
  }, [step, setLayersPanelOpen])

  const goToLayers = () => setStep('layers')
  const goToMonitoraggio = () => {
    panel?.resetToLanding?.()
    setSelectedId(null)
    setStep('monitoraggio')
  }

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
        onClick={() => {
          setSelectedId(null)
          const focused = document.activeElement
          if (focused instanceof HTMLElement && focused.classList.contains('list-item')) {
            focused.blur()
          }
        }}
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
