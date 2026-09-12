/**
 * Geoinsight map surface + green detail modal overlay.
 */
import type { FC } from 'react'
import {
  GeoinsightFocusContainer,
  GeoinsightMapContainer,
  type UseGeoinsightMapBridgeResult,
} from '@/features/territory-map-geoinsight'
import { GreenDetailModal } from '@/features/territory/ui/green-detail/GreenDetailModal'
import type { useGreenFeatureDetail } from '@/features/territory/model/hooks/useGreenFeatureDetail'

type GreenDetailApi = ReturnType<typeof useGreenFeatureDetail>

export type TerritoryMapOverlayProps = {
  map: UseGeoinsightMapBridgeResult
  greenDetail: GreenDetailApi
  onGeometryDrawn: (
    mapId: number,
    geomId: string,
    color: string,
    clip: Record<string, unknown>,
  ) => void
  onSimpleFeatureDrawn: (current: unknown[], deleted?: unknown[]) => void
  onReady: () => void
  onMapPointerDown: (pointer: { clientX: number; clientY: number }) => void
  onDrillFromModal: () => void
}

export const TerritoryMapOverlay: FC<TerritoryMapOverlayProps> = ({
  map,
  greenDetail,
  onGeometryDrawn,
  onSimpleFeatureDrawn,
  onReady,
  onMapPointerDown,
  onDrillFromModal,
}) => (
  <GeoinsightFocusContainer>
    <GeoinsightMapContainer
      onFeatureInfo={map.handleFeatureInfo}
      onDrawnGeometryInfo={map.handleDrawnGeometryInfo}
      onGeometryDrawn={onGeometryDrawn}
      onSimpleFeatureDrawn={onSimpleFeatureDrawn}
      onReady={onReady}
      onMapPointerDown={onMapPointerDown}
    />
    <GreenDetailModal
      isOpen={greenDetail.isOpen}
      status={greenDetail.status}
      selection={greenDetail.selection}
      detail={greenDetail.detail}
      errorNotFound={greenDetail.errorNotFound}
      onClose={greenDetail.close}
      onDrill={onDrillFromModal}
    />
  </GeoinsightFocusContainer>
)
