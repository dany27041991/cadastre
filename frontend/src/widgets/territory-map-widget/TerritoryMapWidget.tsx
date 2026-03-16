/**
 * Territory map widget: map + navigation + green palette composition.
 */
import { useCallback, useEffect, useMemo, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import type Feature from 'ol/Feature'
import { Box } from 'dxc-webkit'
import { territoryApi, useTerritoryMap, useTerritoryNavigation, GreenPalette, LEVEL_GREEN_AREAS, LEVEL_SUB_AREAS } from '@/features/territory'
import { MainContent } from '@/widgets/layout/main/MainContent'
import 'ol/ol.css'

export function TerritoryMapWidget() {
  const { t } = useTranslation()
  const map = useTerritoryMap({ t })
  const storedLeafRef = useRef<{ id: number; feature: Feature } | null>(null)

  const mapBridge = useMemo(
    () => ({
      loadGeoJson: map.loadGeoJson,
      loadGeoJsonAndShowOnlyFeatureById: map.loadGeoJsonAndShowOnlyFeatureById,
      fitToCurrentExtent: map.fitToCurrentExtent,
      centerOnItaly: map.centerOnItaly,
      showOnlyFeature: map.showOnlyFeature,
      loadGreenLayer: map.loadGreenLayer,
      loadGreenLayerFromFeature: map.loadGreenLayerFromFeature,
      setGreenLayerVisible: map.setGreenLayerVisible,
      clearGreenLayer: map.clearGreenLayer,
      clearTerritoryLayer: map.clearTerritoryLayer,
      clearMapVectorLayers: map.clearMapVectorLayers,
      fitToGreenExtent: map.fitToGreenExtent,
      setGreenLayerVisibleWhenMoveEnds: map.setGreenLayerVisibleWhenMoveEnds,
      setTerritoryFillVisible: map.setTerritoryFillVisible,
      storeLeafAreaForRestore: (areaId: number, feature: Feature) => {
        storedLeafRef.current = { id: areaId, feature }
      },
      getStoredLeafArea: (areaId: number): Feature | null =>
        storedLeafRef.current?.id === areaId ? storedLeafRef.current.feature : null,
      clearStoredLeafArea: () => {
        storedLeafRef.current = null
      },
    }),
    [
      map.loadGeoJson,
      map.loadGeoJsonAndShowOnlyFeatureById,
      map.fitToCurrentExtent,
      map.centerOnItaly,
      map.showOnlyFeature,
      map.loadGreenLayer,
      map.loadGreenLayerFromFeature,
      map.setGreenLayerVisible,
      map.clearGreenLayer,
      map.clearTerritoryLayer,
      map.clearMapVectorLayers,
      map.fitToGreenExtent,
      map.setGreenLayerVisibleWhenMoveEnds,
      map.setTerritoryFillVisible,
    ]
  )
  const nav = useTerritoryNavigation(mapBridge, { api: territoryApi, t })

  const restoreGreenAreas = useCallback(async () => {
    const last = nav.breadcrumb[nav.breadcrumb.length - 1]
    if (!last?.regionId || (last.level !== LEVEL_GREEN_AREAS && last.level !== LEVEL_SUB_AREAS)) {
      map.clearGreenLayer()
      storedLeafRef.current = null
      return
    }
    if (!last.provinceId) return
    const geojson =
      last.level === LEVEL_GREEN_AREAS
        ? await territoryApi.getGreenAreas({
            regionId: last.regionId,
            provinceId: last.provinceId,
            municipalityId: last.id,
            subMunicipalAreaId: last.subMunicipalAreaId,
          })
        : await territoryApi.getGreenAreas({
            regionId: last.regionId,
            provinceId: last.provinceId,
            municipalityId:
              last.municipalityId ??
              nav.breadcrumb.find((c) => c.level === 'green_areas')?.id,
            containedInAreaId: last.id,
          })
    const isValidGeoJson =
      geojson != null &&
      (geojson as { type?: string }).type === 'FeatureCollection'
    const hasFeatures = Boolean(isValidGeoJson && geojson.features?.length)
    const storedLeaf =
      last.level === LEVEL_SUB_AREAS && !hasFeatures && storedLeafRef.current?.id === last.id
        ? storedLeafRef.current.feature
        : null
    if (storedLeaf) {
      map.loadGreenLayerFromFeature(storedLeaf)
    } else if (isValidGeoJson) {
      map.loadGreenLayer(geojson, { skipClustering: true })
    } else {
      map.clearGreenLayer()
    }
    map.setGreenLayerVisible(true)
  }, [
    nav.breadcrumb,
    map.loadGreenLayer,
    map.loadGreenLayerFromFeature,
    map.setGreenLayerVisible,
    map.clearGreenLayer,
  ])

  const onBeforeLoadingAssets = useCallback(() => {
    const features = map.getGreenLayerFeatures()
    if (features.length === 1) {
      const f = features[0]
      const id = (f.get('id') ?? f.getId()) as number | undefined
      if (id == null) {
        storedLeafRef.current = null
      } else {
        storedLeafRef.current = { id: Number(id), feature: f }
      }
    } else {
      storedLeafRef.current = null
    }
  }, [map.getGreenLayerFeatures])

  useEffect(() => {
    map.setOnFeatureSelect(nav.handleFeatureSelect)
  }, [map.setOnFeatureSelect, nav.handleFeatureSelect])

  useEffect(() => {
    const last = nav.breadcrumb[nav.breadcrumb.length - 1]
    if (last?.level !== LEVEL_GREEN_AREAS && last?.level !== LEVEL_SUB_AREAS) {
      storedLeafRef.current = null
    }
  }, [nav.breadcrumb])

  useEffect(() => {
    nav.loadRegions()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <Box as="div" display="flex" flexDirection="column" style={{ height: '100%' }}>
      <MainContent
        mapRef={map.mapRef}
        level={nav.level}
        breadcrumb={nav.breadcrumb}
        onLoadRegions={nav.loadRegions}
        onNavigateTo={nav.navigateTo}
      >
        <GreenPalette
          breadcrumb={nav.breadcrumb}
          level={nav.level}
          loadGreenLayer={map.loadGreenLayer}
          setGreenLayerVisible={map.setGreenLayerVisible}
          clearGreenLayer={map.clearGreenLayer}
          restoreGreenAreas={restoreGreenAreas}
          fitToGreenExtent={map.fitToGreenExtent}
          setTerritoryFillVisible={map.setTerritoryFillVisible}
          onBeforeLoadingAssets={onBeforeLoadingAssets}
        />
      </MainContent>
    </Box>
  )
}
