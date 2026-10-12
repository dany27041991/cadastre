/**
 * Jump map+breadcrumb to a territory search hit (same outcome as map drill loaders).
 * Sets crumb stack in one shot to avoid stale React state between chained loaders.
 */
import type { TerritorySearchHit } from '../types/territorySearch'
import type { BreadcrumbCrumb, MapBridge, TerritoryLevel } from '../types'
import type { UseTerritoryNavigationOptions } from '../types'
import {
  LEVEL_GREEN_AREAS,
  LEVEL_MUNICIPALITIES,
  LEVEL_PROVINCES,
  LEVEL_SUB_MUNICIPAL_AREAS,
} from '../model/constants'
import { hasGeoJsonFeatures } from './geoJsonHelpers'
import { filterSubMunicipalByDrill } from './subMunicipalDrill'
import { loadGreenSubAreas } from './loadGreenSubAreas'
import { geoJsonToGeoinsightGeometries } from './geoJsonToGeoinsight'
import type { TerritoryMapFeature } from '../types/mapFeature'

type TerritoryNavigationApi = NonNullable<UseTerritoryNavigationOptions['api']>

type ShowGreenLayer = (
  geojson: Parameters<MapBridge['loadGreenLayer']>[0],
  options?: { includeTerritoryBbox?: boolean; force?: boolean; skipFit?: boolean }
) => void

type ShowLeafArea = (
  feat: TerritoryMapFeature,
  options?: { includeTerritoryBbox?: boolean; force?: boolean; skipFit?: boolean }
) => void

export type JumpToTerritorySearchHitArgs = {
  hit: TerritorySearchHit
  api: TerritoryNavigationApi
  bridge: MapBridge
  suffixProvince: string
  labelGreenAreas: string
  assetsActive: boolean
  areasActive: boolean
  applyGeoJsonToBridge: (geojson: Parameters<MapBridge['loadGeoJson']>[0], fit?: boolean) => void
  clearTerritoryState: () => void
  showGreenLayer: ShowGreenLayer
  showLeafAreaFromFeature: ShowLeafArea
  setLevel: (level: TerritoryLevel) => void
  setBreadcrumb: (crumbs: BreadcrumbCrumb[]) => void
  withLoading: (fn: () => Promise<void>) => Promise<void>
  loadRegions: (options?: { fit?: boolean }) => Promise<void>
}

function leafName(label: string): string {
  const parts = label.split(' - ')
  return parts[parts.length - 1] ?? label
}

function regionNameFromPath(label: string): string {
  const parts = label.split(' - ')
  return parts[1] ?? leafName(label)
}

function pathPart(label: string, index: number): string {
  const parts = label.split(' - ')
  return parts[index] ?? leafName(label)
}

function municipalityNameFromPath(label: string): string {
  // Italia(0) - Region(1) - Province(2) - Municipality(3) - …
  return pathPart(label, 3)
}

function provinceNameFromPath(label: string, suffix: string): string {
  const raw = pathPart(label, 2)
  return raw.endsWith(suffix) ? raw.slice(0, -suffix.length) : raw
}

export async function jumpToTerritorySearchHit(
  args: JumpToTerritorySearchHitArgs
): Promise<void> {
  const {
    hit,
    api,
    bridge,
    suffixProvince,
    labelGreenAreas,
    assetsActive,
    areasActive,
    applyGeoJsonToBridge,
    clearTerritoryState,
    showGreenLayer,
    showLeafAreaFromFeature,
    setLevel,
    setBreadcrumb,
    withLoading,
    loadRegions,
  } = args

  if (hit.level === 'italy') {
    await loadRegions()
    return
  }

  if (hit.id == null) return

  await withLoading(async () => {

    if (hit.level === 'regions') {
      clearTerritoryState()
      setLevel(LEVEL_PROVINCES)
      setBreadcrumb([{ level: LEVEL_PROVINCES, id: hit.id!, label: leafName(hit.label) }])
      // Search has no prior map click fit — must fit to loaded admin layer.
      applyGeoJsonToBridge(await api.getProvincesByRegion(hit.id!), true)
      return
    }

    if (hit.level === 'provinces' && hit.region_id != null) {
      clearTerritoryState()
      setLevel(LEVEL_MUNICIPALITIES)
      setBreadcrumb([
        {
          level: LEVEL_PROVINCES,
          id: hit.region_id,
          label: regionNameFromPath(hit.label),
        },
        {
          level: LEVEL_MUNICIPALITIES,
          id: hit.id!,
          label: `${provinceNameFromPath(hit.label, suffixProvince)}${suffixProvince}`,
        },
      ])
      applyGeoJsonToBridge(await api.getMunicipalitiesByProvince(hit.id!), true)
      return
    }

    if (
      hit.level === 'municipalities' &&
      hit.region_id != null &&
      hit.province_id != null
    ) {
      clearTerritoryState()
      const munLabel = leafName(hit.label)
      setLevel(LEVEL_SUB_MUNICIPAL_AREAS)
      setBreadcrumb([
        {
          level: LEVEL_PROVINCES,
          id: hit.region_id,
          label: regionNameFromPath(hit.label),
        },
        {
          level: LEVEL_MUNICIPALITIES,
          id: hit.province_id,
          label: `${provinceNameFromPath(hit.label, suffixProvince)}${suffixProvince}`,
        },
        {
          level: LEVEL_SUB_MUNICIPAL_AREAS,
          id: hit.id!,
          label: munLabel,
        },
      ])
      const geojson = await api.getSubMunicipalAreasByMunicipality(hit.id!)
      const filtered = filterSubMunicipalByDrill(geojson, 1, [])
      if (hasGeoJsonFeatures(filtered)) {
        applyGeoJsonToBridge(filtered, true)
        return
      }
      // No sub-municipal → green areas at municipality (same as loaders).
      const areasGeojson = await api.getGreenAreas({
        regionId: hit.region_id,
        provinceId: hit.province_id,
        municipalityId: hit.id!,
      })
      if (!hasGeoJsonFeatures(areasGeojson)) {
        // Still frame the municipality boundary when green areas are empty.
        const munis = await api.getMunicipalitiesByProvince(hit.province_id)
        if (hasGeoJsonFeatures(munis)) {
          bridge.loadGeoJsonAndShowOnlyFeatureById(munis, hit.id!)
        }
        return
      }
      setLevel(LEVEL_GREEN_AREAS)
      setBreadcrumb([
        {
          level: LEVEL_PROVINCES,
          id: hit.region_id,
          label: regionNameFromPath(hit.label),
        },
        {
          level: LEVEL_MUNICIPALITIES,
          id: hit.province_id,
          label: `${provinceNameFromPath(hit.label, suffixProvince)}${suffixProvince}`,
        },
        {
          level: LEVEL_SUB_MUNICIPAL_AREAS,
          id: hit.id!,
          label: munLabel,
          navigable: false,
        },
        {
          level: LEVEL_GREEN_AREAS,
          id: hit.id!,
          label: labelGreenAreas,
          regionId: hit.region_id,
          provinceId: hit.province_id,
        },
      ])
      showGreenLayer(areasGeojson)
      return
    }

    if (
      hit.level === 'sub_municipal_areas' &&
      hit.region_id != null &&
      hit.province_id != null &&
      hit.municipality_id != null
    ) {
      clearTerritoryState()
      const subLabel = leafName(hit.label)
      setLevel(LEVEL_GREEN_AREAS)
      setBreadcrumb([
        {
          level: LEVEL_PROVINCES,
          id: hit.region_id,
          label: regionNameFromPath(hit.label),
        },
        {
          level: LEVEL_MUNICIPALITIES,
          id: hit.province_id,
          label: `${provinceNameFromPath(hit.label, suffixProvince)}${suffixProvince}`,
        },
        {
          level: LEVEL_SUB_MUNICIPAL_AREAS,
          id: hit.municipality_id,
          label: municipalityNameFromPath(hit.label),
        },
        {
          level: LEVEL_GREEN_AREAS,
          id: hit.municipality_id,
          label: subLabel,
          subMunicipalAreaId: hit.id!,
          regionId: hit.region_id,
          provinceId: hit.province_id,
        },
      ])
      const subGeo = await api.getSubMunicipalAreasByMunicipality(hit.municipality_id)
      const subCount = subGeo.features?.length ?? 0
      const match =
        subGeo.features?.find(
          (f) => f.id === hit.id || (f.properties?.id as number) === hit.id
        ) ?? null
      if (hasGeoJsonFeatures(subGeo) && match) {
        bridge.loadGeoJsonAndShowOnlyFeatureById(subGeo, hit.id!)
      } else if (hasGeoJsonFeatures(subGeo)) {
        // Id mismatch: still load layer and fit full municipality sub-areas.
        applyGeoJsonToBridge(subGeo, true)
      } else {
        const munis = await api.getMunicipalitiesByProvince(hit.province_id)
        if (hasGeoJsonFeatures(munis)) {
          bridge.loadGeoJsonAndShowOnlyFeatureById(munis, hit.municipality_id)
        }
      }
      if (!assetsActive) {
        const areasGeojson = await api.getGreenAreas({
          regionId: hit.region_id,
          provinceId: hit.province_id,
          municipalityId: hit.municipality_id,
          subMunicipalAreaId: hit.id!,
        })
        if (hasGeoJsonFeatures(areasGeojson)) {
          // Keep territory framing; green mount should not override admin zoom when
          // we already fitted the selected sub-municipal feature.
          showGreenLayer(areasGeojson, { skipFit: Boolean(match) })
        }
      }
      return
    }

    if (
      (hit.level === 'green_areas' || hit.level === 'sub_areas') &&
      hit.region_id != null &&
      hit.province_id != null
    ) {
      // Seed admin crumb so loadGreenSubAreas can resolve province/municipality.
      const adminCrumbs: BreadcrumbCrumb[] = [
        {
          level: LEVEL_PROVINCES,
          id: hit.region_id,
          label: regionNameFromPath(hit.label),
        },
        {
          level: LEVEL_MUNICIPALITIES,
          id: hit.province_id,
          label: `${provinceNameFromPath(hit.label, suffixProvince)}${suffixProvince}`,
        },
      ]
      if (hit.municipality_id != null) {
        adminCrumbs.push({
          level: LEVEL_SUB_MUNICIPAL_AREAS,
          id: hit.municipality_id,
          label: municipalityNameFromPath(hit.label) || labelGreenAreas,
        })
      }
      setBreadcrumb(adminCrumbs)
      await loadGreenSubAreas({
        api,
        bridge,
        breadcrumb: adminCrumbs,
        areaId: hit.id!,
        regionId: hit.region_id,
        label: leafName(hit.label),
        labelGreenAreas,
        suffixProvince,
        assetsActive,
        areasActive,
        showGreenLayer,
        showLeafAreaFromFeature,
        setLevel,
        setBreadcrumb,
      })
      // Map drill uses skipFit to keep prior zoom; search jump must frame the target.
      const scoped = await api.getGreenAreas({
        regionId: hit.region_id,
        provinceId: hit.province_id,
        municipalityId: hit.municipality_id ?? undefined,
      })
      const leaf =
        scoped.features?.find(
          (f) => f.id === hit.id || (f.properties?.id as number) === hit.id
        ) ?? null
      if (leaf?.geometry) {
        const { metas } = geoJsonToGeoinsightGeometries(
          { type: 'FeatureCollection', features: [leaf] },
          'search-green-'
        )
        const bbox = metas[0]?.bbox ?? null
        if (bbox) {
          const [minLon, minLat, maxLon, maxLat] = bbox
          bridge.zoomToLonLatAtScreenFraction((minLon + maxLon) / 2, (minLat + maxLat) / 2, {
            bbox,
            fractionX: 0.5,
            fractionY: 0.5,
          })
        }
      } else {
        bridge.fitToGreenExtent(false)
      }
    }
  })
}

/** Build SearchInput display path from current breadcrumb. */
export function territoryPathFromBreadcrumb(
  breadcrumb: readonly BreadcrumbCrumb[],
  italiaLabel: string
): string {
  if (breadcrumb.length === 0) return italiaLabel
  return `${italiaLabel} - ${breadcrumb.map((c) => c.label).join(' - ')}`
}