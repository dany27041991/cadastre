/**
 * InfoPanel wizard: Monitoraggio → Aree gestite / Assets Verdi → Filtri tabella.
 * Monitoraggio: no footer (entry via Area Italia click).
 * Layers: Indietro + Avanti (Avanti only if at least one layer toggle is on).
 * Filters: Indietro + Cerca.
 *
 * Layout wrappers use native div (not dxc Box): Box mutates style.color and
 * crashes under React frozen props ("color" is read-only).
 */
import { useState, useEffect, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Button, InfoPanel, icons } from 'dxc-webkit'
import { useGreenTablePanelOptional } from '@/features/territory/context/GreenTablePanelContext'
import { GreenTablePanelSections } from './GreenTablePanelSections'
import { LayersPanel } from './LayersPanel'
import { MonitoraggioPanel, type MonitoraggioActionId } from './MonitoraggioPanel'

type PanelStep = 'monitoraggio' | 'layers' | 'filters'

const AREA_ITALIA: MonitoraggioActionId = 'area-italia'

const panelShellStyle = {
  height: '100%',
  background: 'white',
  overflow: 'auto',
  boxSizing: 'border-box' as const,
}

const panelFlexShellStyle = {
  height: '100%',
  background: 'white',
  boxSizing: 'border-box' as const,
  display: 'flex',
  flexDirection: 'column' as const,
  minHeight: 0,
}

const panelFlexBodyStyle = {
  flex: 1,
  minHeight: 0,
  overflow: 'auto',
  overflowX: 'hidden' as const,
}

function InfoPanelFooter({
  backLabel,
  onBack,
  primaryLabel,
  onPrimary,
  showPrimary,
  primaryWithArrow,
  primaryWithSearchIcon,
}: {
  readonly backLabel: string
  readonly onBack: () => void
  readonly primaryLabel?: string
  readonly onPrimary?: () => void
  readonly showPrimary: boolean
  readonly primaryWithArrow?: boolean
  readonly primaryWithSearchIcon?: boolean
}) {
  return (
    <div className="Container-button" style={{ overflow: 'hidden' }}>
      <div className="btn-page-prev-next d-flex align-items-center">
        <div>
          <Button color="primary" kind="outlined" onClick={onBack}>
            <icons.VectorIcon
              style={{
                transform: 'rotate(180deg)',
                width: '10px',
                height: '10px',
                marginRight: '10px',
              }}
            />
            <div className="infopanel-button-text">{backLabel}</div>
          </Button>
        </div>
        {showPrimary && primaryLabel && onPrimary ? (
          <div>
            <Button color="primary" kind="filled" onClick={onPrimary}>
              {primaryWithSearchIcon ? (
                <icons.SearchIcon
                  size="xs"
                  style={{ width: '14px', height: '14px', marginRight: '8px' }}
                />
              ) : null}
              <div className="infopanel-button-text">{primaryLabel}</div>
              {primaryWithArrow ? (
                <icons.VectorIcon
                  style={{ width: '10px', height: '10px', marginLeft: '10px' }}
                />
              ) : null}
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  )
}

function PanelShell({
  children,
  footer,
}: {
  readonly children: ReactNode
  readonly footer: ReactNode
}) {
  return (
    <div style={panelFlexShellStyle}>
      <div style={panelFlexBodyStyle}>
        <InfoPanel optionSearchBar={[]} searchText={undefined} hideSearch hideFooter>
          {children}
        </InfoPanel>
      </div>
      {footer}
    </div>
  )
}

export function InfoPanelContent() {
  const { t } = useTranslation()
  const panel = useGreenTablePanelOptional()
  const setLayersPanelOpen = panel?.setLayersPanelOpen
  const [step, setStep] = useState<PanelStep>('monitoraggio')
  const [selectedId, setSelectedId] = useState<MonitoraggioActionId | null>(null)

  const layer = panel?.greenAssetsLayer
  const hasActiveLayer = layer != null && (layer.areasActive || layer.active)

  useEffect(() => {
    setLayersPanelOpen?.(step === 'layers' || step === 'filters')
  }, [step, setLayersPanelOpen])

  // If user turns off all toggles while on filters, return to layers.
  useEffect(() => {
    if (step === 'filters' && !hasActiveLayer) {
      setStep('layers')
    }
  }, [step, hasActiveLayer])

  const goToLayers = () => setStep('layers')
  const goToFilters = () => {
    if (!hasActiveLayer) return
    setStep('filters')
  }
  const goToMonitoraggio = () => {
    panel?.resetToLanding?.()
    panel?.resetPanelState()
    setSelectedId(null)
    setStep('monitoraggio')
  }

  const handleSearch = () => {
    panel?.setMapTableAccordionVisible(true)
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
      <div
        onClick={() => {
          setSelectedId(null)
          const focused = document.activeElement
          if (focused instanceof HTMLElement && focused.classList.contains('list-item')) {
            focused.blur()
          }
        }}
        style={panelShellStyle}
      >
        <InfoPanel optionSearchBar={[]} searchText={undefined} hideSearch hideFooter>
          <MonitoraggioPanel
            selectedId={selectedId}
            onSelect={handleMonitoraggioSelect}
            onClearSelection={() => setSelectedId(null)}
          />
        </InfoPanel>
      </div>
    )
  }

  if (step === 'filters') {
    return (
      <PanelShell
        footer={
          <InfoPanelFooter
            backLabel={t('territory.panel.btnBack')}
            onBack={goToLayers}
            primaryLabel={t('territory.panel.btnSearch')}
            onPrimary={handleSearch}
            showPrimary
            primaryWithArrow={false}
            primaryWithSearchIcon
          />
        }
      >
        <GreenTablePanelSections />
      </PanelShell>
    )
  }

  return (
    <PanelShell
      footer={
        <InfoPanelFooter
          backLabel={t('territory.panel.btnBack')}
          onBack={goToMonitoraggio}
          primaryLabel={t('territory.panel.btnForward')}
          onPrimary={goToFilters}
          showPrimary={hasActiveLayer}
          primaryWithArrow
        />
      }
    >
      <LayersPanel />
    </PanelShell>
  )
}
