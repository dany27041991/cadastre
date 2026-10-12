/**
 * Mount map layers after a green-area Esplodi / Seleziona (assets viewport or static polygons).
 */
import type { GeoJSONFeatureCollection } from '@/shared/types'
import { territoryApi } from '../api/territory.api'
import { fetchGreenAreasForDrillScope } from './greenAreaDrill'
import { hasGeoJsonFeatures } from './geoJsonHelpers'
import type { TerritoryMapFeature } from '../types/mapFeature'
import type { MapBridge } from '../types'

type FetchGreenAreas = typeof territoryApi.getGreenAreas

type ShowGreenLayer = (
  geojson: Parameters<MapBridge['loadGreenLayer']>[0],
  options?: { includeTerritoryBbox?: boolean; force?: boolean; skipFit?: boolean }
) => void

type ShowLeafArea = (
  feat: TerritoryMapFeature,
  options?: { includeTerritoryBbox?: boolean; force?: boolean; skipFit?: boolean }
) => void

export type MountGreenDrillResultArgs = {
  bridge: MapBridge
  getGreenAreas: FetchGreenAreas
  areaId: number
  regionId: number
  provinceId: number
  municipalityId: number | undefined
  childrenGeojson: GeoJSONFeatureCollection
  clickedFeature?: unknown
  assetsActive: boolean
  areasActive: boolean
  showGreenLayer: ShowGreenLayer
  showLeafAreaFromFeature: ShowLeafArea
}

export async function mountGreenDrillResult(args: MountGreenDrillResultArgs): Promise<void> {
  const {
    bridge,
    getGreenAreas,
    areaId,
    regionId,
    provinceId,
    municipalityId,
    childrenGeojson,
    clickedFeature,
    assetsActive,
    areasActive,
    showGreenLayer,
    showLeafAreaFromFeature,
  } = args

  if (assetsActive) {
    bridge.loadGreenLayerViewport(
      (bbox, zoom) =>
        territoryApi.getGreenAssetsViewport({
          bbox,
          zoom,
          greenAreaId: areaId,
          regionId,
          provinceId,
          municipalityId,
        }),
      areasActive
        ? () =>
            fetchGreenAreasForDrillScope(
              getGreenAreas,
              areaId,
              regionId,
              provinceId,
              municipalityId
            )
        : undefined
    )
    bridge.setGreenLayerVisible(true)
    return
  }

  if (hasGeoJsonFeatures(childrenGeojson)) {
    showGreenLayer(childrenGeojson, {
      includeTerritoryBbox: false,
      force: true,
      skipFit: true,
    })
    return
  }

  if (clickedFeature) {
    showLeafAreaFromFeature(clickedFeature as TerritoryMapFeature, {
      includeTerritoryBbox: false,
      force: true,
      skipFit: true,
    })
    return
  }

  const leafScoped = await fetchGreenAreasForDrillScope(
    getGreenAreas,
    areaId,
    regionId,
    provinceId,
    municipalityId
  )
  if (hasGeoJsonFeatures(leafScoped)) {
    showGreenLayer(leafScoped, {
      includeTerritoryBbox: false,
      force: true,
      skipFit: true,
    })
  }
}
