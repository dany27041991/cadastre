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
      const pointer = lastMapPointerRef.current
      const anchor = resolveGreenDetailAnchorLonLat(feature, pointer)
      if (anchor) {
        frameGreenDetailOnMap(feature, anchor.lon, anchor.lat, {
          forceMaxZoom: layerKind === LAYER_KIND_GREEN_ASSET,
        })
      }
      greenDetail.openFromSelection(id, label, feature, layerKind, pointer)
      if (anchor) placeDetailPanelAtMapFraction()
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
      const mountedFeature = mounted.find((f) => f.id === hit.id)
      const feature: TerritoryMapFeature = mountedFeature ?? {
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
