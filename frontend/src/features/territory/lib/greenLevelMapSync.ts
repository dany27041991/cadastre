/**
 * Sync admin territory outline + green polygons when navigating to green_areas / sub_areas.
 * Pure async helpers (no React) — called from breadcrumb navigate / resync.
 */
import { filterGreenAreaChildren } from './greenAreaDrill'
import { hasGeoJsonFeatures, geoJsonHasFeatureId } from './geoJsonHelpers'
import type { TerritoryMapFeature } from '../types/mapFeature'
import type { BreadcrumbCrumb, MapBridge } from '../types'

type TerritoryNavigationApi = NonNullable<
  import('../types').UseTerritoryNavigationOptions['api']
>

type GreenLayerGeoJson = Parameters<MapBridge['loadGreenLayer']>[0]

export async function loadTerritoryForGreenLevel(
  api: TerritoryNavigationApi,
  bridge: MapBridge,
  newCrumb: BreadcrumbCrumb[],
  last: BreadcrumbCrumb
): Promise<void> {
  if (last.level === 'sub_areas' && last.regionId != null && last.provinceId != null && newCrumb.length >= 2) {
    const parentCrumb = newCrumb[newCrumb.length - 2]
    if (parentCrumb.level === 'green_areas') {
      /**
       * green_areas crumb id is municipality_id, not a green area id.
       * parent_id on API = children of that *green area* → wrong query if we pass municipality id.
       * Load roots for the municipality and highlight `last` only if it is a root; otherwise
       * skip vector outline (green layer will show sub-areas + fit).
       */
      const munGeo = await api.getGreenAreas({
        regionId: last.regionId,
        provinceId: last.provinceId,
        municipalityId: parentCrumb.id,
        subMunicipalAreaId: parentCrumb.subMunicipalAreaId,
      })
      if (hasGeoJsonFeatures(munGeo) && geoJsonHasFeatureId(munGeo, last.id)) {
        bridge.loadGeoJsonAndShowOnlyFeatureById(munGeo, last.id)
      }
      return
    }
    /** Parent crumb is sub_areas: parentCrumb.id is a green area → API parent_id is correct. */
    const parentGeo = await api.getGreenAreas({
      regionId: last.regionId,
      provinceId: last.provinceId,
      parentId: parentCrumb.id,
    })
    if (hasGeoJsonFeatures(parentGeo)) {
      bridge.loadGeoJsonAndShowOnlyFeatureById(parentGeo, last.id)
    }
    return
  }
  if (last.level !== 'green_areas' || last.regionId == null) return
  if (last.subMunicipalAreaId != null) {
    const subGeo = await api.getSubMunicipalAreasByMunicipality(last.id)
    if (hasGeoJsonFeatures(subGeo)) {
      bridge.loadGeoJsonAndShowOnlyFeatureById(subGeo, last.subMunicipalAreaId)
    }
    return
  }
  const municipalitiesCrumb = newCrumb.find((c) => c.level === 'municipalities')
  if (municipalitiesCrumb) {
    const munGeo = await api.getMunicipalitiesByProvince(municipalitiesCrumb.id)
    if (hasGeoJsonFeatures(munGeo)) {
      bridge.loadGeoJsonAndShowOnlyFeatureById(munGeo, last.id)
    }
  }
}

export async function handleGreenLevelNavigation(
  last: BreadcrumbCrumb,
  newCrumb: BreadcrumbCrumb[],
  geojson: GreenLayerGeoJson,
  api: TerritoryNavigationApi | undefined,
  bridge: MapBridge,
  showGreenLayer: (g: GreenLayerGeoJson) => void,
  showLeafArea: (f: TerritoryMapFeature) => void,
  assetsLayerActive: boolean
): Promise<void> {
  // Assets toggle owns the green layer (viewport clusters). Clearing/replacing
  // it with area polygons races the scope refetch and leaves the map without clusters.
  if (!assetsLayerActive) {
    bridge.clearGreenLayer()
  }
  bridge.clearTerritoryLayer()
  if (api) await loadTerritoryForGreenLevel(api, bridge, newCrumb, last)
  if (assetsLayerActive) return
  if (hasGeoJsonFeatures(geojson)) {
    const toShow =
      last.level === 'sub_areas'
        ? filterGreenAreaChildren(geojson, last.id)
        : geojson
    showGreenLayer(toShow)
  } else {
    const leafFeature = last.level === 'sub_areas' ? bridge.getStoredLeafArea?.(last.id) : undefined
    if (leafFeature) showLeafArea(leafFeature)
    else bridge.clearGreenLayer()
  }
}
