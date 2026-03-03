/**
 * Tree icon button: toggles the green layer (trees, rows, lawns, etc.) for the selected area.
 */
import { useState, useCallback, useEffect } from 'react'
import { territoryApi } from '../../api/territory.api'
import type { BreadcrumbCrumb, GreenContext, GreenPaletteProps } from '../../types'
import { LEVEL_GREEN_AREAS, LEVEL_SUB_AREAS } from '../../model/constants'
import { LoadingOverlay } from '../loading-overlay/LoadingOverlay'
import { TreeIcon } from '../tree-icon/TreeIcon'
import styles from './GreenPalette.module.css'

function getGreenContext(breadcrumb: BreadcrumbCrumb[]): GreenContext | null {
  if (breadcrumb.length === 0) return null
  const regionId = breadcrumb[0]?.id
  if (regionId == null) return null

  const greenAreasCrumb = breadcrumb.find((b) => b.level === LEVEL_GREEN_AREAS)
  const subAreaCrumbs = breadcrumb.filter((b) => b.level === LEVEL_SUB_AREAS)

  let municipalityId: number | undefined
  let subMunicipalAreaId: number | undefined
  let greenAreaId: number | undefined

  if (subAreaCrumbs.length > 0) {
    greenAreaId = subAreaCrumbs[subAreaCrumbs.length - 1]?.id
    municipalityId = greenAreasCrumb?.id
  } else if (greenAreasCrumb) {
    municipalityId = greenAreasCrumb.id
    subMunicipalAreaId = greenAreasCrumb.subMunicipalAreaId
  }

  if (municipalityId == null) return null
  const provinceId = greenAreasCrumb?.provinceId ?? breadcrumb[1]?.id
  return { regionId, provinceId, municipalityId, subMunicipalAreaId, greenAreaId }
}

export function GreenPalette({
  breadcrumb,
  level,
  loadGreenLayer,
  setGreenLayerVisible,
  clearGreenLayer,
  restoreGreenAreas,
  fitToGreenExtent,
  setTerritoryFillVisible,
  onBeforeLoadingAssets,
}: GreenPaletteProps) {
  const [isGreenLayerActive, setIsGreenLayerActive] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  const context = getGreenContext(breadcrumb)

  const turnOffGreenLayer = useCallback(async () => {
    setIsGreenLayerActive(false)
    if (restoreGreenAreas) {
      await restoreGreenAreas()
    } else {
      setGreenLayerVisible(false)
      clearGreenLayer()
    }
  }, [setGreenLayerVisible, clearGreenLayer, restoreGreenAreas])

  useEffect(() => {
    if (level === LEVEL_GREEN_AREAS || level === LEVEL_SUB_AREAS) {
      return
    }
    turnOffGreenLayer()
  }, [
    level,
    context?.regionId,
    context?.municipalityId,
    context?.subMunicipalAreaId,
    context?.greenAreaId,
    turnOffGreenLayer,
  ])

  const handleToggleClick = useCallback(async () => {
    if (!context || context.provinceId == null || context.municipalityId == null) return

    if (isGreenLayerActive) {
      turnOffGreenLayer()
      return
    }

    setTerritoryFillVisible(false)
    onBeforeLoadingAssets?.()
    setIsLoading(true)
    try {
      const geojson = await territoryApi.getGreenAssets({
        regionId: context.regionId,
        provinceId: context.provinceId,
        municipalityId: context.municipalityId,
        greenAreaId: context.greenAreaId,
        subMunicipalAreaId: context.subMunicipalAreaId,
      })
      loadGreenLayer(geojson)
      setGreenLayerVisible(true)
      setTerritoryFillVisible(false)
      setIsGreenLayerActive(true)
      fitToGreenExtent()
    } catch (e) {
      turnOffGreenLayer()
    } finally {
      setIsLoading(false)
    }
  }, [
    context,
    isGreenLayerActive,
    turnOffGreenLayer,
    loadGreenLayer,
    setGreenLayerVisible,
    setTerritoryFillVisible,
    fitToGreenExtent,
  ])

  const isDisabled = context == null || isLoading
  const buttonClassName = [
    styles.button,
    isGreenLayerActive && styles.buttonActive,
    isDisabled && styles.buttonDisabled,
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <>
      {isLoading && (
        <LoadingOverlay />
      )}
      <div className={styles.buttonContainer}>
        <button
          type="button"
          className={buttonClassName}
          onClick={handleToggleClick}
          disabled={isDisabled}
          aria-pressed={isGreenLayerActive}
        >
          <TreeIcon />
        </button>
      </div>
    </>
  )
}
