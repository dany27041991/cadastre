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
import { markPerfScan } from '../../lib/perfScan'

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
    const t0 = Date.now()
    markPerfScan('areas_http_start', { zoom })
    // #region agent log
    fetch('http://127.0.0.1:7455/ingest/ee4d7135-3aef-4e11-b07a-3de89c3bf62c',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'4fe799'},body:JSON.stringify({sessionId:'4fe799',runId:'survey-exclude',hypothesisId:'H-survey-exclude',location:'greenAssetsViewportFetch.areasFetcher',message:'areas_fetch_start',data:{zoom,bbox,filterKeys:Object.keys(filters??{}),filters:filters??{},survey_date_from:(filters as Record<string,string>|undefined)?.survey_date_from,survey_date_to:(filters as Record<string,string>|undefined)?.survey_date_to,hasSignal:!!signal},timestamp:Date.now()})}).catch(()=>{})
    // #endregion
    const fc = await territoryApi.getGreenAreasViewport(
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
    const ms = Date.now() - t0
    markPerfScan('areas_http_done', { zoom, ms, n: fc.features?.length ?? 0 })
    // #region agent log
    fetch('http://127.0.0.1:7455/ingest/ee4d7135-3aef-4e11-b07a-3de89c3bf62c',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'4fe799'},body:JSON.stringify({sessionId:'4fe799',runId:'survey-exclude',hypothesisId:'H-survey-exclude',location:'greenAssetsViewportFetch.areasFetcher',message:'areas_fetch_done',data:{zoom,ms,nFeatures:fc.features?.length??0,filterKeys:Object.keys(filters??{}),sampleNames:(fc.features??[]).slice(0,3).map(f=>String((f.properties as {name?:string}|null)?.name??''))},timestamp:Date.now()})}).catch(()=>{})
    // #endregion
    return fc
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
    // #region agent log
    fetch('http://127.0.0.1:7455/ingest/ee4d7135-3aef-4e11-b07a-3de89c3bf62c',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'4fe799'},body:JSON.stringify({sessionId:'4fe799',runId:'cerca-no-cam',hypothesisId:'H-no-fit',location:'greenAssetsViewportFetch.startViewportMode',message:'cerca_fit_disarm',data:{areaFilterKeys:Object.keys(areaF??{}),assetFilterKeys:Object.keys(filters??{})},timestamp:Date.now()})}).catch(()=>{})
    // #endregion
  }
  // #region agent log
  fetch('http://127.0.0.1:7455/ingest/ee4d7135-3aef-4e11-b07a-3de89c3bf62c',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'4fe799'},body:JSON.stringify({sessionId:'4fe799',runId:'cluster-filter',hypothesisId:'H1-H2',location:'useGreenAssetsLayer.ts:startViewportMode',message:'viewport_start',data:{assetFilterKeys:Object.keys(filters??{}),areaFilterKeys:Object.keys(areaF??{}),includeAreas,hasAssetFilters:!!filters,hasAreaFilters:!!areaF,passAreaToAssets:!!areaF},timestamp:Date.now()})}).catch(()=>{})
  // #endregion
  const assetsFetcher = async (
    bbox: [number, number, number, number],
    zoom: number,
  ) => {
    const t0 = Date.now()
    const signal = currentViewportAbortSignal()
    markPerfScan('assets_http_start', { zoom })
    // #region agent log
    fetch('http://127.0.0.1:7455/ingest/ee4d7135-3aef-4e11-b07a-3de89c3bf62c',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'4fe799'},body:JSON.stringify({sessionId:'4fe799',runId:'villa-clusters',hypothesisId:'H2-slow',location:'greenAssetsViewportFetch.assetsFetcher',message:'assets_fetch_start',data:{zoom,bbox,areaFilterKeys:Object.keys(areaF??{}),assetFilterKeys:Object.keys(filters??{}),greenAreaId:greenAreaId??null,hasSignal:!!signal},timestamp:Date.now()})}).catch(()=>{})
    // #endregion
    try {
      const fc = await territoryApi.getGreenAssetsViewport(
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
      // #region agent log
      const feats = fc.features ?? []
      let nCluster = 0
      let nRaw = 0
      const clusterSum = feats.reduce((s, f) => {
        const p = f.properties as { count?: number; cluster_count?: number; cluster?: boolean } | null
        if (p?.cluster === true) {
          nCluster += 1
          const c = Number(p?.cluster_count ?? p?.count ?? 0)
          return s + (Number.isFinite(c) ? c : 0)
        }
        nRaw += 1
        return s
      }, 0)
      const ms = Date.now() - t0
      markPerfScan('assets_http_done', {
        zoom,
        ms,
        n: feats.length,
        nCluster,
        nRaw,
        clusterSum,
      })
      fetch('http://127.0.0.1:7455/ingest/ee4d7135-3aef-4e11-b07a-3de89c3bf62c', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Debug-Session-Id': '4fe799',
        },
        body: JSON.stringify({
          sessionId: '4fe799',
          runId: 'asset-cluster-count',
          hypothesisId: 'H-A-B-D',
          location: 'greenAssetsViewportFetch.assetsFetcher',
          message: 'assets_fetch_done',
          data: {
            zoom,
            ms,
            nFeatures: feats.length,
            nCluster,
            nRaw,
            clusterSum,
            assetFilterKeys: Object.keys(filters ?? {}),
            assetFilters: filters ?? {},
            areaFilterKeys: Object.keys(areaF ?? {}),
            areaFilters: areaF ?? {},
            kind:
              nCluster && !nRaw
                ? 'clusters'
                : nRaw && !nCluster
                  ? 'raw'
                  : nCluster || nRaw
                    ? 'mixed'
                    : 'empty',
            sample: feats.slice(0, 5).map((f) => {
              const p = f.properties as {
                count?: number
                cluster_count?: number
                cluster?: boolean
                cluster_key?: string
              } | null
              return {
                id: f.id,
                cluster: p?.cluster === true,
                key: p?.cluster_key ?? null,
                count: p?.cluster_count ?? p?.count ?? null,
              }
            }),
          },
          timestamp: Date.now(),
        }),
      }).catch(() => {})
      // #endregion
      return fc
    } catch (err) {
      // #region agent log
      fetch('http://127.0.0.1:7455/ingest/ee4d7135-3aef-4e11-b07a-3de89c3bf62c',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'4fe799'},body:JSON.stringify({sessionId:'4fe799',runId:'villa-clusters',hypothesisId:'H2-slow',location:'greenAssetsViewportFetch.assetsFetcher',message:'assets_fetch_err',data:{zoom,ms:Date.now()-t0,err:String(err)},timestamp:Date.now()})}).catch(()=>{})
      // #endregion
      throw err
    }
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
  const areaF = filtersOrUndef(areaFilters)
  // #region agent log
  fetch('http://127.0.0.1:7455/ingest/ee4d7135-3aef-4e11-b07a-3de89c3bf62c',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'4fe799'},body:JSON.stringify({sessionId:'4fe799',runId:'persist',hypothesisId:'H-toggle',location:'greenAssetsViewportFetch.startAreasOnlyViewportMode',message:'areas_only_start',data:{areaFilterKeys:Object.keys(areaF??{}),filters:areaF??{}},timestamp:Date.now()})}).catch(()=>{})
  // #endregion
  const emptyAssets = async () => EMPTY_FEATURE_COLLECTION
  loadGreenLayerViewport(
    emptyAssets,
    areasFetcherFor(context, clipWkt, dateFrom, dateTo, areaFilters),
  )
}
