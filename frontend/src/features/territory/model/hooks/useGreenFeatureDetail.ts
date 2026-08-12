/**
 * Click-driven green area / green asset detail (FloatingPanel).
 */
import { useCallback, useRef, useState } from 'react'
import {
  fetchGreenDetail,
  GreenDetailHttpError,
  type GreenDetailDto,
  type GreenDetailKind,
} from '@/features/territory/api/greenDetail.api'
import { territoryApi } from '@/features/territory/api/territory.api'
import { areaHasGreenChildren } from '@/features/territory/lib/greenAreaDrill'
import type { TerritoryMapFeature } from '@/features/territory/types/mapFeature'
import type { BreadcrumbCrumb } from '@/features/territory/types'
import { getGreenContext } from '@/features/territory/lib/greenMapContext'
import {
  resolveGreenDetailAnchorLonLat,
  bboxFromMapFeature,
  lonLatFromMapFeature,
} from '@/features/territory/lib/greenDetailMapAnchor'
import {
  GREEN_DETAIL_KIND_AREA,
  GREEN_DETAIL_KIND_ASSET,
  GREEN_DETAIL_STATUS_ERROR,
  GREEN_DETAIL_STATUS_IDLE,
  GREEN_DETAIL_STATUS_LOADING,
  GREEN_DETAIL_STATUS_READY,
  LAYER_KIND_GREEN_ASSET,
  LEVEL_MUNICIPALITIES,
  LEVEL_PROVINCES,
  LEVEL_SUB_MUNICIPAL_AREAS,
  type GreenDetailStatusConst,
  type GreenMapLayerKind,
} from '@/features/territory/model/constants'

export type GreenDetailStatus = GreenDetailStatusConst

export type GreenDetailPointer = {
  clientX: number
  clientY: number
}

export type GreenDetailSelection = {
  kind: GreenDetailKind
  id: number
  regionId: number
  provinceId: number
  primaryLabel: string
  regionLabel?: string
  municipalityLabel?: string
  feature: TerritoryMapFeature
  clientX: number
  clientY: number
  /** Geographic anchor — panel follows this point across pan/zoom. null = screen-only (table open). */
  anchorLon: number | null
  anchorLat: number | null
  /** Area only: true when sub-areas exist (CTA Esplodi). null = probing. */
  canDrill: boolean | null
}

export type UseGreenFeatureDetailArgs = {
  breadcrumb: BreadcrumbCrumb[]
}

function kindFromLayer(layerKind: GreenMapLayerKind): GreenDetailKind {
  return layerKind === LAYER_KIND_GREEN_ASSET
    ? GREEN_DETAIL_KIND_ASSET
    : GREEN_DETAIL_KIND_AREA
}

function primaryFromFeature(
  feature: TerritoryMapFeature,
  kind: GreenDetailKind
): string {
  const p = feature.properties
  if (kind === GREEN_DETAIL_KIND_ASSET) {
    return (
      String(p.species ?? '') ||
      String(p.genus ?? '') ||
      String(p.asset_type ?? '') ||
      feature.label ||
      String(feature.id)
    )
  }
  return String(p.name ?? '') || feature.label || String(feature.id)
}

function breadcrumbLabels(breadcrumb: BreadcrumbCrumb[]): {
  regionLabel?: string
  municipalityLabel?: string
} {
  const regionLabel = breadcrumb.find((c) => c.level === LEVEL_PROVINCES)?.label
  const municipalityLabel = breadcrumb.find(
    (c) => c.level === LEVEL_SUB_MUNICIPAL_AREAS
  )?.label
  return { regionLabel, municipalityLabel }
}

function toPositiveInt(value: unknown): number | null {
  const n = typeof value === 'string' && value.trim() === '' ? NaN : Number(value)
  return Number.isFinite(n) && n > 0 ? n : null
}

function resolveScopeIds(
  feature: TerritoryMapFeature,
  breadcrumb: BreadcrumbCrumb[]
): { regionId: number; provinceId: number; municipalityId?: number } | null {
  const ctx = getGreenContext(breadcrumb)
  const props = feature.properties
  const regionId =
    toPositiveInt(props.region_id) ??
    toPositiveInt(ctx.regionId) ??
    toPositiveInt(breadcrumb.find((c) => c.level === LEVEL_PROVINCES)?.id) ??
    toPositiveInt(breadcrumb.find((c) => c.regionId != null)?.regionId)
  const provinceId =
    toPositiveInt(props.province_id) ??
    toPositiveInt(ctx.provinceId) ??
    toPositiveInt(breadcrumb.find((c) => c.level === LEVEL_MUNICIPALITIES)?.id) ??
    toPositiveInt(breadcrumb.find((c) => c.provinceId != null)?.provinceId)
  if (regionId == null || provinceId == null) return null
  const municipalityId =
    toPositiveInt(ctx.municipalityId) ?? toPositiveInt(props.municipality_id) ?? undefined
  return { regionId, provinceId, municipalityId }
}

async function probeAreaCanDrill(
  areaId: number,
  regionId: number,
  provinceId: number,
  municipalityId?: number
): Promise<boolean> {
  return areaHasGreenChildren(
    territoryApi.getGreenAreas,
    areaId,
    regionId,
    provinceId,
    municipalityId
  )
}

export function useGreenFeatureDetail({ breadcrumb }: UseGreenFeatureDetailArgs) {
  const [status, setStatus] = useState<GreenDetailStatus>(GREEN_DETAIL_STATUS_IDLE)
  const [selection, setSelection] = useState<GreenDetailSelection | null>(null)
  const [detail, setDetail] = useState<GreenDetailDto | null>(null)
  const [errorNotFound, setErrorNotFound] = useState(false)

  const abortRef = useRef<AbortController | null>(null)
  const activeKeyRef = useRef<string | null>(null)

  const close = useCallback(() => {
    abortRef.current?.abort()
    abortRef.current = null
    activeKeyRef.current = null
    setStatus(GREEN_DETAIL_STATUS_IDLE)
    setSelection(null)
    setDetail(null)
    setErrorNotFound(false)
  }, [])

  const updateAnchorScreen = useCallback((clientX: number, clientY: number) => {
    setSelection((prev) =>
      prev && (prev.clientX !== clientX || prev.clientY !== clientY)
        ? { ...prev, clientX, clientY }
        : prev
    )
  }, [])

  const openFromSelection = useCallback(
    (
      id: number,
      label: string,
      feature: TerritoryMapFeature,
      layerKind: GreenMapLayerKind,
      pointer?: GreenDetailPointer | null
    ) => {
      const kind = kindFromLayer(layerKind)
      const scope = resolveScopeIds(feature, breadcrumb)
      const labels = breadcrumbLabels(breadcrumb)
      const primaryLabel = primaryFromFeature(feature, kind) || label
      const anchor = resolveGreenDetailAnchorLonLat(feature, pointer)
      const clientX =
        anchor?.screen.clientX ??
        pointer?.clientX ??
        Math.round(window.innerWidth / 2)
      const clientY =
        anchor?.screen.clientY ??
        pointer?.clientY ??
        Math.round(window.innerHeight * 0.35)
      // null until we have a real lon/lat — avoids follow-map projecting (0,0) off-viewport
      const anchorLon = anchor?.lon ?? null
      const anchorLat = anchor?.lat ?? null

      if (!scope) {
        setSelection({
          kind,
          id,
          regionId: 0,
          provinceId: 0,
          primaryLabel,
          ...labels,
          feature,
          clientX,
          clientY,
          anchorLon,
          anchorLat,
          canDrill: false,
        })
        setDetail(null)
        setErrorNotFound(false)
        setStatus(GREEN_DETAIL_STATUS_ERROR)
        activeKeyRef.current = `${kind}:${id}:noscope`
        return
      }

      const { regionId, provinceId, municipalityId } = scope
      const key = `${kind}:${id}:${regionId}:${provinceId}`
      activeKeyRef.current = key
      setSelection({
        kind,
        id,
        regionId,
        provinceId,
        primaryLabel,
        regionLabel: labels.regionLabel,
        municipalityLabel: labels.municipalityLabel,
        feature,
        clientX,
        clientY,
        anchorLon,
        anchorLat,
        canDrill: kind === GREEN_DETAIL_KIND_AREA ? null : false,
      })
      setDetail(null)
      setErrorNotFound(false)
      setStatus(GREEN_DETAIL_STATUS_LOADING)

      abortRef.current?.abort()
      const ac = new AbortController()
      abortRef.current = ac

      if (kind === GREEN_DETAIL_KIND_AREA) {
        void probeAreaCanDrill(id, regionId, provinceId, municipalityId).then((canDrill) => {
          if (activeKeyRef.current !== key) return
          setSelection((prev) =>
            prev && prev.id === id && prev.kind === GREEN_DETAIL_KIND_AREA
              ? { ...prev, canDrill }
              : prev
          )
        })
      }

      void fetchGreenDetail(kind, { id, regionId, provinceId }, ac.signal)
        .then((dto) => {
          if (activeKeyRef.current !== key) return
          setDetail(dto)
          if (dto.geometry || (dto.bbox && dto.bbox.length === 4)) {
            setSelection((prev) => {
              if (!prev || prev.id !== id) return prev
              // Keep mounted map geometry when present (true shape already).
              if (bboxFromMapFeature(prev.feature)) return prev
              const geometry = dto.geometry ?? null
              if (!geometry) {
                // Bbox alone — keep screen framing via center, no fake rectangle highlight.
                if (!dto.bbox) return prev
                const lon = (dto.bbox[0] + dto.bbox[2]) / 2
                const lat = (dto.bbox[1] + dto.bbox[3]) / 2
                return { ...prev, anchorLon: lon, anchorLat: lat }
              }
              const feature = { ...prev.feature, geometry }
              const center = lonLatFromMapFeature(feature)
              return {
                ...prev,
                feature,
                anchorLon: center?.[0] ?? prev.anchorLon,
                anchorLat: center?.[1] ?? prev.anchorLat,
              }
            })
          }
          setStatus(GREEN_DETAIL_STATUS_READY)
        })
        .catch((err: unknown) => {
          if (ac.signal.aborted) return
          if (activeKeyRef.current !== key) return
          if (err instanceof GreenDetailHttpError && err.status === 404) {
            setErrorNotFound(true)
            setStatus(GREEN_DETAIL_STATUS_ERROR)
            return
          }
          setStatus(GREEN_DETAIL_STATUS_ERROR)
        })
    },
    [breadcrumb]
  )

  return {
    status,
    selection,
    detail,
    errorNotFound,
    isOpen: status !== GREEN_DETAIL_STATUS_IDLE && selection != null,
    openFromSelection,
    updateAnchorScreen,
    close,
  }
}
