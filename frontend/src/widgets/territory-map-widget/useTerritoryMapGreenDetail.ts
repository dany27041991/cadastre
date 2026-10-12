/**
 * Green feature detail: open from map / table / search, frame, highlight, accordion hide.
 */
import { useCallback, useEffect, useRef } from 'react'
import { useGreenFeatureDetail } from '@/features/territory/model/hooks/useGreenFeatureDetail'
import { resolveGreenDetailAnchorLonLat, bboxFromMapFeature } from '@/features/territory/lib/greenDetailMapAnchor'
import { resolveGreenFeatureFromTableRow } from '@/features/territory/lib/greenTableRowToMapFeature'
import {
  LAYER_KIND_GREEN_AREA,
  LAYER_KIND_GREEN_ASSET,
  GREEN_DETAIL_STATUS_READY,
} from '@/features/territory/model/constants'
import type { TerritoryMapFeature } from '@/features/territory/types/mapFeature'
import type { TerritorySearchHit } from '@/features/territory/types/territorySearch'
import type { BreadcrumbCrumb } from '@/features/territory/types'
import type { GreenTableRawRow } from '@/features/territory/ui/green-data-table/GreenTableRowActions'
import type { UseGeoinsightMapBridgeResult } from '@/features/territory-map-geoinsight'

export type UseTerritoryMapGreenDetailArgs = {
  map: UseGeoinsightMapBridgeResult
  breadcrumb: BreadcrumbCrumb[]
  dateFromIso: string
  dateToIso: string
  setMapTableAccordionVisible: (visible: boolean) => void
  drillGreenArea: (id: number, label: string, feature?: TerritoryMapFeature) => void
}

export function useTerritoryMapGreenDetail({
  map,
  breadcrumb,
  dateFromIso,
  dateToIso,
  setMapTableAccordionVisible,
  drillGreenArea,
}: UseTerritoryMapGreenDetailArgs) {
  const greenDetail = useGreenFeatureDetail({
    breadcrumb,
    dateFrom: dateFromIso,
    dateTo: dateToIso,
  })
  const lastMapPointerRef = useRef<{ clientX: number; clientY: number } | null>(null)
  /** Table row had no map geometry — frame once detail bbox arrives. */
  const pendingTableFrameRef = useRef(false)

  // Collapse green data accordion while the detail panel is open.
  useEffect(() => {
    if (!greenDetail.isOpen) return
    setMapTableAccordionVisible(false)
  }, [greenDetail.isOpen, setMapTableAccordionVisible])

  // Red selection: recolor mounted GA_/GS_ while detail is open (no GH_ overlay labels).
  useEffect(() => {
    if (!greenDetail.isOpen || !greenDetail.selection) {
      map.clearGreenDetailHighlight()
      return
    }
    const preferAsset = greenDetail.selection.kind === 'asset'
    const feature = {
      ...greenDetail.selection.feature,
      properties: {
        ...greenDetail.selection.feature.properties,
        __greenKind: greenDetail.selection.kind,
      },
    }
    map.setGreenDetailHighlight(feature, { preferAsset })
  }, [
    map,
    greenDetail.isOpen,
    greenDetail.selection?.id,
    greenDetail.selection?.kind,
    greenDetail.selection?.anchorLon,
    greenDetail.selection?.anchorLat,
    // Re-apply when true geometry arrives from detail API (replaces empty/bbox placeholder).
    (greenDetail.selection?.feature.geometry as { type?: string } | undefined)?.type,
  ])

  // Unmount-only cleanup (avoid StrictMode clear/set thrash removing the red flash).
  useEffect(() => {
    return () => {
      map.clearGreenDetailHighlight()
    }
  }, [map])

  const placeDetailPanelAtMapFraction = useCallback((): {
    clientX: number
    clientY: number
  } | null => {
    const mapEl =
      typeof document !== 'undefined'
        ? document.querySelector('.ol-viewport') ??
          document.querySelector('[aria-label="Map view"]')
        : null
    if (!mapEl) return null
    const rect = mapEl.getBoundingClientRect()
    if (rect.width <= 0 || rect.height <= 0) return null
    const clientX = Math.round(rect.left + rect.width * 0.5)
    const clientY = Math.round(rect.top + rect.height * 0.2)
    greenDetail.updateAnchorScreen(clientX, clientY)
    return { clientX, clientY }
  }, [greenDetail.updateAnchorScreen])

  const frameGreenDetailOnMap = useCallback(
    (
      feature: TerritoryMapFeature,
      lon: number,
      lat: number,
      options?: { forceMaxZoom?: boolean },
    ) => {
      const bbox = bboxFromMapFeature(feature)
      map.zoomToLonLatAtScreenFraction(lon, lat, {
        bbox,
        forceMaxZoom: options?.forceMaxZoom,
      })
      placeDetailPanelAtMapFraction()
    },
    [map, placeDetailPanelAtMapFraction],
  )

  useEffect(() => {
    map.setOnGreenDetailSelect((id, label, feature, layerKind) => {
      // #region agent log
      const geom = feature.geometry as { type?: string; coordinates?: unknown } | undefined
      const geomCoords = Array.isArray(geom?.coordinates)
        ? (geom!.coordinates as unknown[]).slice(0, 2)
        : null
      fetch('http://127.0.0.1:7455/ingest/ee4d7135-3aef-4e11-b07a-3de89c3bf62c',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'4fe799'},body:JSON.stringify({sessionId:'4fe799',runId:'asset-pos',hypothesisId:'H2-geom',location:'useTerritoryMapGreenDetail:mapSelect',message:'map_open_detail',data:{id,label,layerKind,featMuni:feature.properties?.municipality_id??null,geomType:geom?.type??null,geomCoords,hasGeom:!!(geom&&geom.type)},timestamp:Date.now()})}).catch(()=>{})
      // #endregion
      const pointer = lastMapPointerRef.current
      const anchor = resolveGreenDetailAnchorLonLat(feature, pointer)
      // #region agent log
      fetch('http://127.0.0.1:7455/ingest/ee4d7135-3aef-4e11-b07a-3de89c3bf62c',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'4fe799'},body:JSON.stringify({sessionId:'4fe799',runId:'asset-pos',hypothesisId:'H1-race',location:'useTerritoryMapGreenDetail:anchor',message:'detail_anchor_resolved',data:{id,layerKind,pointer,anchorLon:anchor?.lon??null,anchorLat:anchor?.lat??null,anchorScreen:anchor?.screen??null,forceMaxZoom:layerKind===LAYER_KIND_GREEN_ASSET},timestamp:Date.now()})}).catch(()=>{})
      // #endregion
      if (anchor) {
        frameGreenDetailOnMap(feature, anchor.lon, anchor.lat, {
          forceMaxZoom: layerKind === LAYER_KIND_GREEN_ASSET,
        })
      }
      greenDetail.openFromSelection(id, label, feature, layerKind, pointer)
      if (anchor) {
        const framed = placeDetailPanelAtMapFraction()
        // #region agent log
        fetch('http://127.0.0.1:7455/ingest/ee4d7135-3aef-4e11-b07a-3de89c3bf62c',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'4fe799'},body:JSON.stringify({sessionId:'4fe799',runId:'asset-pos',hypothesisId:'H3-zoom-frac',location:'useTerritoryMapGreenDetail:framed',message:'detail_panel_framed_50_20',data:{id,layerKind,framed,pointerBefore:pointer},timestamp:Date.now()})}).catch(()=>{})
        // #endregion
      }
    })
  }, [
    map,
    greenDetail.openFromSelection,
    frameGreenDetailOnMap,
    placeDetailPanelAtMapFraction,
  ])

  const handleMapPointerDown = useCallback(
    (pointer: { clientX: number; clientY: number }) => {
      lastMapPointerRef.current = pointer
    },
    [],
  )

  const handleDrillFromModal = useCallback(() => {
    const sel = greenDetail.selection
    if (!sel || sel.kind !== 'area') return
    greenDetail.close()
    drillGreenArea(sel.id, sel.primaryLabel, sel.feature)
  }, [greenDetail, drillGreenArea])

  const handleOpenGreenDetailFromTable = useCallback(
    (row: GreenTableRawRow, kind: 'area' | 'asset') => {
      const mounted = map.getGreenLayerFeatures()
      const resolved = resolveGreenFeatureFromTableRow(row, kind, mounted)
      if (!resolved) return
      const layerKind =
        kind === 'asset' ? LAYER_KIND_GREEN_ASSET : LAYER_KIND_GREEN_AREA
      // #region agent log
      const rg=(resolved.feature.geometry as {type?:string;coordinates?:unknown}|undefined)
      fetch('http://127.0.0.1:7455/ingest/ee4d7135-3aef-4e11-b07a-3de89c3bf62c',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'4fe799'},body:JSON.stringify({sessionId:'4fe799',runId:'asset-vs-area',hypothesisId:'H-mounted-kind',location:'useTerritoryMapGreenDetail:tableOpen',message:'table_open_detail',data:{kind,rowId:row.id,rowMuni:row.municipality_id,plantCode:row.plant_code??null,speciesCode:row.species_code??null,greenAreaId:row.green_area_id??null,rowAreaCode:row.area_code??row.zril_identifier??null,resolvedId:resolved.id,featMuni:resolved.feature.properties?.municipality_id??null,geomType:rg?.type??null,geomCoords:Array.isArray(rg?.coordinates)?(rg!.coordinates as unknown[]).slice(0,2):null,mountedN:mounted.length,preferAsset:kind==='asset'},timestamp:Date.now()})}).catch(()=>{})
      // #endregion
      const anchor = resolveGreenDetailAnchorLonLat(resolved.feature, null)
      if (anchor) {
        frameGreenDetailOnMap(resolved.feature, anchor.lon, anchor.lat, {
          forceMaxZoom: kind === 'asset',
        })
      } else {
        pendingTableFrameRef.current = true
      }
      // Geographic anchors from the feature — never pass the framing screen
      // point as a "click" pointer (that inverted 50%/20% into wrong lon/lat).
      greenDetail.openFromSelection(
        resolved.id,
        resolved.label,
        resolved.feature,
        layerKind,
        null,
      )
      placeDetailPanelAtMapFraction()
    },
    [
      map,
      greenDetail.openFromSelection,
      frameGreenDetailOnMap,
      placeDetailPanelAtMapFraction,
    ],
  )

  const openGreenAreaDetailFromSearch = useCallback(
    (hit: TerritorySearchHit) => {
      if (hit.level !== 'green_areas' && hit.level !== 'sub_areas') return
      if (hit.id == null || hit.region_id == null || hit.province_id == null) {
        return
      }
      const parts = hit.label.includes(' - ') ? hit.label.split(' - ') : null
      const leaf = parts != null ? (parts[parts.length - 1] ?? hit.label).trim() : hit.label
      const mounted = map.getGreenLayerFeatures()
      // Area ids restart per municipality — never match mounted by id alone.
      const mountedFeature = mounted.find((f) => {
        if (f.id !== hit.id) return false
        if (hit.municipality_id == null) return true
        return Number(f.properties?.municipality_id) === hit.municipality_id
      })
      const feature: TerritoryMapFeature = mountedFeature
        ? {
            ...mountedFeature,
            properties: {
              ...mountedFeature.properties,
              region_id: hit.region_id,
              province_id: hit.province_id,
              ...(hit.municipality_id != null
                ? { municipality_id: hit.municipality_id }
                : {}),
            },
          }
        : {
            id: hit.id,
            label: leaf,
            properties: {
              name: leaf,
              region_id: hit.region_id,
              province_id: hit.province_id,
              ...(hit.municipality_id != null
                ? { municipality_id: hit.municipality_id }
                : {}),
            },
            geometry: {},
          }
      const anchor = resolveGreenDetailAnchorLonLat(feature, null)
      if (anchor) {
        frameGreenDetailOnMap(feature, anchor.lon, anchor.lat)
      } else {
        pendingTableFrameRef.current = true
      }
      greenDetail.openFromSelection(
        hit.id,
        leaf,
        feature,
        LAYER_KIND_GREEN_AREA,
        null,
      )
      placeDetailPanelAtMapFraction()
    },
    [
      map,
      greenDetail.openFromSelection,
      frameGreenDetailOnMap,
      placeDetailPanelAtMapFraction,
    ],
  )

  // Table→detail: zoom when API bbox arrives (no mounted map geometry).
  useEffect(() => {
    if (!pendingTableFrameRef.current) return
    if (greenDetail.status !== GREEN_DETAIL_STATUS_READY) return
    const bbox = greenDetail.detail?.bbox
    if (!bbox || bbox.length !== 4) {
      pendingTableFrameRef.current = false
      return
    }
    pendingTableFrameRef.current = false
    const lon = (bbox[0] + bbox[2]) / 2
    const lat = (bbox[1] + bbox[3]) / 2
    const forceMaxZoom =
      greenDetail.selection?.kind === 'asset' || greenDetail.detail?.kind === 'asset'
    map.zoomToLonLatAtScreenFraction(lon, lat, { bbox, forceMaxZoom })
    placeDetailPanelAtMapFraction()
  }, [
    greenDetail.status,
    greenDetail.detail,
    greenDetail.selection?.kind,
    map,
    placeDetailPanelAtMapFraction,
  ])

  return {
    greenDetail,
    handleMapPointerDown,
    handleDrillFromModal,
    handleOpenGreenDetailFromTable,
    openGreenAreaDetailFromSearch,
  }
}
