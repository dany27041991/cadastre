/**
 * Main app: territory map with hierarchical navigation.
 */
import { useEffect, useMemo } from 'react'
import { territoryApi } from '@/api/territory'
import { useTerritoryMap } from '@/shared/hooks/useTerritoryMap'
import { useTerritoryNavigation } from '@/shared/hooks/useTerritoryNavigation'
import { GreenPalette } from '@/features/map/components/map'
import { MainContent } from '@/components/layout/main-content/MainContent'
import 'ol/ol.css'

export default function App() {
  const map = useTerritoryMap()
  const mapBridge = useMemo(
    () => ({
      loadGeoJson: map.loadGeoJson,
      fitToCurrentExtent: map.fitToCurrentExtent,
      centerOnItaly: map.centerOnItaly,
      showOnlyFeature: map.showOnlyFeature,
    }),
    [
      map.loadGeoJson,
      map.fitToCurrentExtent,
      map.centerOnItaly,
      map.showOnlyFeature,
    ]
  )
  const nav = useTerritoryNavigation(mapBridge, { api: territoryApi })

  useEffect(() => {
    map.setOnFeatureSelect(nav.handleFeatureSelect)
  }, [map.setOnFeatureSelect, nav.handleFeatureSelect])

  useEffect(() => {
    nav.loadRegions()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
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
          fitToGreenExtent={map.fitToGreenExtent}
          setTerritoryFillVisible={map.setTerritoryFillVisible}
        />
      </MainContent>
    </div>
  )
}
