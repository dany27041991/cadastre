/**
 * Viewport fetchers for green assets / areas companions.
 * Used by useGreenAssetsLayer to start assets or areas-only viewport mode.
 */
import type { GeoJSONFeatureCollection } from '@/shared/types'
import { territoryApi } from '../../api/territory.api'
import type { GreenContext } from '../../types'
import { fetchGreenAreasForDrillScope } from '../../lib/greenAreaDrill'
import { clearFilterFit } from '../hooks/filterFitGate'
import { currentViewportAbortSignal } from '../hooks/viewportLoadGate'
const EMPTY_FEATURE_COLLECTION: GeoJSONFeatureCollection = {
  type: 'FeatureCollection',
  features: [],
}

export type ViewportFetcher = (
  fetcher: (
    bbox: [number, number, number, number],
    zoom: number
  ) => Promise<GeoJSONFeatureCollection>,
  areasFetcher?: (
    bbox: [number, number, number, number],
    zoom: number
  ) => Promise<GeoJSONFeatureCollection>
) => void

export type AppliedFilters = Readonly<Record<string, string>> | null | undefined

export function scopeFromContext(context: GreenContext) {
  return {
    regionId: context.regionId,
    provinceId: context.provinceId,
    municipalityId: context.municipalityId,
    subMunicipalAreaId: context.subMunicipalAreaId,
  }
}

export function filtersOrUndef(filters: AppliedFilters): AppliedFilters {
  if (!filters || Object.keys(filters).length === 0) return undefined
  return filters
}

export function areasFetcherFor(
  context: GreenContext,
  clipWkt?: string | null,
  dateFrom?: string | null,
  dateTo?: string | null,
  areaFilters?: AppliedFilters,
) {
  const scope = scopeFromContext(context)
  const greenAreaId = context.greenAreaId
  const filters = filtersOrUndef(areaFilters)
  // After Esplodi / Seleziona: keep companion areas inside the drilled scope
  // (viewport roots would re-show every municipality area).
  if (
    greenAreaId != null &&
    scope.regionId != null &&
    scope.provinceId != null
  ) {
    const fetchAreas = (params: Parameters<typeof territoryApi.getGreenAreas>[0]) =>
      territoryApi.getGreenAreas({
        ...params,
        ...(dateFrom ? { dateFrom } : {}),
        ...(dateTo ? { dateTo } : {}),
        ...(filters ? { filters } : {}),
      })
    return async () =>
      fetchGreenAreasForDrillScope(
        fetchAreas,
        greenAreaId,
        scope.regionId as number,
        scope.provinceId as number,
        scope.municipalityId
      )
  }
  return async (bbox: [number, number, number, number], zoom: number) => {
    const signal = currentViewportAbortSignal()
    return territoryApi.getGreenAreasViewport(
      {
        bbox,
        zoom,
        ...scope,
        ...(clipWkt ? { clipWkt } : {}),
        ...(dateFrom ? { dateFrom } : {}),
        ...(dateTo ? { dateTo } : {}),
        ...(filters ? { filters } : {}),
      },
      signal ? { signal } : undefined,
    )
  }
}

export function startViewportMode(
  context: GreenContext,
  loadGreenLayerViewport: ViewportFetcher,
  includeAreas: boolean,
  clipWkt?: string | null,
  dateFrom?: string | null,
  dateTo?: string | null,
  areaFilters?: AppliedFilters,
  assetFilters?: AppliedFilters,
): void {
  const scope = scopeFromContext(context)
  const greenAreaId = context.greenAreaId
  const filters = filtersOrUndef(assetFilters)
  const areaF = filtersOrUndef(areaFilters)
  if (areaF || filters) {
    // Cerca: keep current camera. armFilterFit caused zoom/span (debug 4fe799).
    clearFilterFit('cerca-no-camera')
  }
  const assetsFetcher = async (
    bbox: [number, number, number, number],
    zoom: number,
  ) => {
    const signal = currentViewportAbortSignal()
    return territoryApi.getGreenAssetsViewport(
      {
        bbox,
        zoom,
        greenAreaId,
        ...scope,
        ...(clipWkt ? { clipWkt } : {}),
        ...(dateFrom ? { dateFrom } : {}),
        ...(dateTo ? { dateTo } : {}),
        ...(filters ? { filters } : {}),
        ...(areaF ? { areaFilters: areaF } : {}),
      },
      signal ? { signal } : undefined,
    )
  }
  loadGreenLayerViewport(
    assetsFetcher,
    includeAreas
      ? areasFetcherFor(context, clipWkt, dateFrom, dateTo, areaFilters)
      : undefined,
  )
}

/** Assets off + areas on: keep area polygons via empty assets + areas companion. */
export function startAreasOnlyViewportMode(
  context: GreenContext,
  loadGreenLayerViewport: ViewportFetcher,
  clipWkt?: string | null,
  dateFrom?: string | null,
  dateTo?: string | null,
  areaFilters?: AppliedFilters,
): void {
  const emptyAssets = async () => EMPTY_FEATURE_COLLECTION
  loadGreenLayerViewport(
    emptyAssets,
    areasFetcherFor(context, clipWkt, dateFrom, dateTo, areaFilters),
  )
}
