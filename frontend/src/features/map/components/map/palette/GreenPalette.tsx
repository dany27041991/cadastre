/**
 * Tree icon button: toggles the green layer (trees, rows, lawns, etc.) for the selected area.
 */
import { useState, useCallback, useEffect } from 'react'
import { territoryApi } from '@/api/territory'
import type { BreadcrumbCrumb } from '@/shared/types/territory'
import type { GreenContext, GreenPaletteProps } from '@/features/map/types/interfaces/mapComponents.interfaces'
import { LoadingOverlay } from './loading-overlay/LoadingOverlay'
import { TreeIcon } from './tree-icon/TreeIcon'
import styles from './GreenPalette.module.css'

export type { GreenContext, GreenPaletteProps } from '@/features/map/types/interfaces/mapComponents.interfaces'

function getGreenContext(breadcrumb: BreadcrumbCrumb[]): GreenContext | null {
  if (breadcrumb.length === 0) return null
  const regionId = breadcrumb[0]?.id
  if (regionId == null) return null

  const greenAreasCrumb = breadcrumb.find((b) => b.level === 'green_areas')
  const subAreaCrumbs = breadcrumb.filter((b) => b.level === 'sub_areas')

  let municipalityId: number | undefined
  let districtId: number | undefined
  let greenAreaId: number | undefined

  if (subAreaCrumbs.length > 0) {
    greenAreaId = subAreaCrumbs[subAreaCrumbs.length - 1]?.id
    municipalityId = greenAreasCrumb?.id
  } else if (greenAreasCrumb) {
    municipalityId = greenAreasCrumb.id
    districtId = greenAreasCrumb.districtId
  }

  if (municipalityId == null) return null
  return { regionId, municipalityId, districtId, greenAreaId }
}

export function GreenPalette({
  breadcrumb,
  level: _level,
  loadGreenLayer,
  setGreenLayerVisible,
  clearGreenLayer,
  fitToGreenExtent,
  setTerritoryFillVisible,
}: GreenPaletteProps) {
  const [isGreenLayerActive, setIsGreenLayerActive] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  const context = getGreenContext(breadcrumb)

  const turnOffGreenLayer = useCallback(() => {
    setIsGreenLayerActive(false)
    setGreenLayerVisible(false)
    setTerritoryFillVisible(true)
    clearGreenLayer()
  }, [setGreenLayerVisible, setTerritoryFillVisible, clearGreenLayer])

  useEffect(() => {
    turnOffGreenLayer()
  }, [
    context?.regionId,
    context?.municipalityId,
    context?.districtId,
    context?.greenAreaId,
    turnOffGreenLayer,
  ])

  const handleToggleClick = useCallback(async () => {
    if (!context) return

    if (isGreenLayerActive) {
      turnOffGreenLayer()
      return
    }

    setTerritoryFillVisible(false)
    setIsLoading(true)
    try {
      const geojson = await territoryApi.getGreenAssets({
        regionId: context.regionId,
        municipalityId: context.municipalityId,
        districtId: context.districtId,
        greenAreaId: context.greenAreaId,
      })
      loadGreenLayer(geojson)
      setGreenLayerVisible(true)
      setTerritoryFillVisible(false)
      setIsGreenLayerActive(true)
      fitToGreenExtent()
    } catch {
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
