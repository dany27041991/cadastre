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
import { toast } from 'react-toastify'
import { Button, InfoPanel, icons } from 'dxc-webkit'
import { useGreenTablePanelOptional } from '@/features/territory/context/GreenTablePanelContext'
import { findInvalidFilterRange } from '@/features/territory/lib/greenTableFilterFields'
import { GreenTablePanelSections } from './GreenTablePanelSections'
import { LayersPanel } from './LayersPanel'
import { DrawPromptPanel } from './DrawPromptPanel'
import { MonitoraggioPanel, type MonitoraggioActionId } from './MonitoraggioPanel'

type PanelStep = 'monitoraggio' | 'draw' | 'layers' | 'filters'

const AREA_ITALIA: MonitoraggioActionId = 'area-italia'
const DRAW_ON_MAP: MonitoraggioActionId = 'draw-on-map'

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
  primaryDisabled = false,
  clearLabel,
  onClear,
  showClear = false,
  clearDisabled = false,
}: {
  readonly backLabel: string
  readonly onBack: () => void
  readonly primaryLabel?: string
  readonly onPrimary?: () => void
  readonly showPrimary: boolean
  readonly primaryWithArrow?: boolean
  readonly primaryWithSearchIcon?: boolean
  readonly primaryDisabled?: boolean
  readonly clearLabel?: string
  readonly onClear?: () => void
  readonly showClear?: boolean
  readonly clearDisabled?: boolean
}) {
  return (
    <div className="Container-button" style={{ overflow: 'hidden' }}>
      <div
        className="btn-page-prev-next d-flex align-items-center"
        style={{ justifyContent: 'space-between', width: '100%', gap: '8px' }}
      >
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
        <div className="d-flex align-items-center" style={{ gap: '8px' }}>
          {showClear && clearLabel && onClear ? (
            <Button
              color="primary"
              kind="outlined"
              onClick={onClear}
              disabled={clearDisabled}
            >
              <div className="infopanel-button-text">{clearLabel}</div>
              <icons.TrashIcon
                size="xs"
                style={{ width: '14px', height: '14px', marginLeft: '8px' }}
              />
            </Button>
          ) : null}
          {showPrimary && primaryLabel && onPrimary ? (
            <Button
              color="primary"
              kind="filled"
              onClick={onPrimary}
              disabled={primaryDisabled}
            >
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
          ) : null}
        </div>
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

  const goToDraw = () => setStep('draw')
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

  const abortDraw = () => {
    if (panel?.entryMode !== 'draw') return
    panel.setEntryMode('admin')
    panel.setSpatialClip(null)
  }

  const handleSearch = () => {
    if (!panel) return
    const invalid = findInvalidFilterRange(
      panel.columnFiltersByKind.area,
      panel.columnFiltersByKind.asset,
    )
    if (invalid) {
      const fieldLabel = t(`territory.panel.detail.meta.${invalid.baseKey}`, {
        defaultValue: invalid.baseKey,
      })
      toast.error(t('territory.panel.filterRangeInvalid', { field: fieldLabel }))
      return
    }
    panel.applyFiltersAndShowResults()
  }

  const handleClearFilters = () => {
    panel?.clearAllSearchFilters()
  }

  const hasDraftOrAppliedFilters = (() => {
    if (!panel) return false
    const maps = [
      panel.columnFiltersByKind.area,
      panel.columnFiltersByKind.asset,
      panel.appliedFiltersByKind.area,
      panel.appliedFiltersByKind.asset,
    ]
    return maps.some((m) => Object.keys(m).length > 0)
  })()

  const handleMonitoraggioSelect = (id: MonitoraggioActionId) => {
    setSelectedId(id)
    if (id === DRAW_ON_MAP) {
      panel?.setSpatialClip(null)
      panel?.setEntryMode('draw')
      goToDraw()
      return
    }
    abortDraw()
    if (id === AREA_ITALIA) {
      goToLayers()
    }
  }

  useEffect(() => {
    if (panel?.entryMode !== 'draw') return
    if (panel.spatialClip != null) {
      if (step === 'draw') setStep('layers')
      return
    }
    if (step === 'layers' || step === 'filters') {
      panel.setMapTableAccordionVisible(false)
      void panel.greenAssetsLayer?.setActive(false)
      void panel.greenAssetsLayer?.setAreasActive(false)
      setStep('draw')
    }
  }, [step, panel, panel?.spatialClip, panel?.entryMode])

  if (step === 'monitoraggio') {
    return (
      <div
        onClick={() => {
          setSelectedId(null)
          abortDraw()
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
            onClearSelection={() => {
              setSelectedId(null)
              abortDraw()
            }}
          />
        </InfoPanel>
      </div>
    )
  }

  if (step === 'draw') {
    return (
      <PanelShell
        footer={
          <InfoPanelFooter
            backLabel={t('territory.panel.btnBack')}
            onBack={goToMonitoraggio}
            showPrimary={false}
          />
        }
      >
        <DrawPromptPanel />
      </PanelShell>
    )
  }

  if (step === 'filters') {
    return (
      <PanelShell
        footer={
          <InfoPanelFooter
            backLabel={t('territory.panel.btnBack')}
            onBack={goToLayers}
            clearLabel={t('territory.panel.btnClearFilters')}
            onClear={handleClearFilters}
            showClear
            clearDisabled={!hasDraftOrAppliedFilters}
            primaryLabel={t('territory.panel.btnSearch')}
            onPrimary={handleSearch}
            showPrimary
            primaryWithArrow={false}
            primaryWithSearchIcon
            primaryDisabled={panel?.hasIngestDateRange !== true}
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
