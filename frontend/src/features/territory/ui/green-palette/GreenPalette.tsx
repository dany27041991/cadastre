/**
 * Tree icon button: toggles the green layer (trees, rows, lawns, etc.) for the selected area.
 */
import { useState, useCallback, useEffect, useRef } from 'react'
import { Box } from 'dxc-webkit'
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
  assetsLayerActive,
  onAssetsLayerActiveChange,
}: GreenPaletteProps) {
  const isGreenLayerActive = assetsLayerActive
  const [isLoading, setIsLoading] = useState(false)
  const lastContextKeyRef = useRef<string | null>(null)
  const prevBreadcrumbLengthRef = useRef(breadcrumb.length)
  const breadcrumbShortenedRef = useRef(false)

  const context = getGreenContext(breadcrumb)
  const contextKey =
    context == null
      ? null
      : [context.regionId, context.provinceId, context.municipalityId, context.subMunicipalAreaId, context.greenAreaId].join(
          ','
        )

  const turnOffGreenLayer = useCallback(async () => {
    lastContextKeyRef.current = null
    onAssetsLayerActiveChange(false)
    if (restoreGreenAreas) {
      await restoreGreenAreas()
    } else {
      setGreenLayerVisible(false)
      clearGreenLayer()
    }
  }, [setGreenLayerVisible, clearGreenLayer, restoreGreenAreas, onAssetsLayerActiveChange])

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

  // When user clicks breadcrumb (path shortens), deactivate the button and hide green assets.
  useEffect(() => {
    if (breadcrumb.length < prevBreadcrumbLengthRef.current) {
      breadcrumbShortenedRef.current = true
      turnOffGreenLayer()
    }
    prevBreadcrumbLengthRef.current = breadcrumb.length
  }, [breadcrumb.length, turnOffGreenLayer])

  // When user navigates (e.g. back from sub_areas to green_areas), refetch assets for the new context so the layer shows the correct data.
  useEffect(() => {
    if (breadcrumbShortenedRef.current) {
      breadcrumbShortenedRef.current = false
      return
    }
    if (
      level !== LEVEL_GREEN_AREAS &&
      level !== LEVEL_SUB_AREAS
    ) return
    if (!isGreenLayerActive || context == null || context.provinceId == null || context.municipalityId == null) return
    if (contextKey === lastContextKeyRef.current) return

    lastContextKeyRef.current = contextKey
    setTerritoryFillVisible(false)
    onBeforeLoadingAssets?.()
    setIsLoading(true)
    const params = {
      regionId: context.regionId,
      provinceId: context.provinceId,
      municipalityId: context.municipalityId,
      greenAreaId: context.greenAreaId,
      subMunicipalAreaId: context.subMunicipalAreaId,
    }
    territoryApi
      .getGreenAssets(params)
      .then((geojson) => {
        loadGreenLayer(geojson)
        setGreenLayerVisible(true)
        setTerritoryFillVisible(false)
        fitToGreenExtent()
      })
      .catch(() => {
        lastContextKeyRef.current = null
        turnOffGreenLayer()
      })
      .finally(() => {
        setIsLoading(false)
      })
  }, [
    level,
    isGreenLayerActive,
    contextKey,
    context,
    loadGreenLayer,
    setGreenLayerVisible,
    setTerritoryFillVisible,
    fitToGreenExtent,
    turnOffGreenLayer,
    onBeforeLoadingAssets,
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
    const params = {
      regionId: context.regionId,
      provinceId: context.provinceId,
      municipalityId: context.municipalityId,
      greenAreaId: context.greenAreaId,
      subMunicipalAreaId: context.subMunicipalAreaId,
    }
    try {
      const geojson = await territoryApi.getGreenAssets(params)
      lastContextKeyRef.current = contextKey
      loadGreenLayer(geojson)
      setGreenLayerVisible(true)
      setTerritoryFillVisible(false)
      onAssetsLayerActiveChange(true)
      fitToGreenExtent()
    } catch {
      turnOffGreenLayer()
    } finally {
      setIsLoading(false)
    }
  }, [
    context,
    contextKey,
    isGreenLayerActive,
    turnOffGreenLayer,
    loadGreenLayer,
    setGreenLayerVisible,
    setTerritoryFillVisible,
    fitToGreenExtent,
    onAssetsLayerActiveChange,
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
      <Box as="div" className={styles.buttonContainer}>
        <button
          type="button"
          className={buttonClassName}
          onClick={handleToggleClick}
          disabled={isDisabled}
          aria-pressed={isGreenLayerActive}
        >
          <TreeIcon />
        </button>
      </Box>
    </>
  )
}
