import type { GeoinsightRef } from '@mase/commons-geoinsight'
import { geoinsightConfig } from '@/app/config/geoinsight'
import { useGeoinsightStore } from '@/app/store/useGeoinsightStore'

export function getGeoinsightRef(): GeoinsightRef | null | undefined {
  return useGeoinsightStore.getState().geoinsightRef?.current
}

export function getGeoinsightMapId(): number {
  return geoinsightConfig.mapId
}
