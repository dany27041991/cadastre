import type { TerritoryMapFeature } from '@/features/territory/types/mapFeature'

export interface GeoinsightLeafStorage {
  store(areaId: number, feature: TerritoryMapFeature): void
  get(areaId: number): TerritoryMapFeature | null
  clear(): void
}

export function createGeoinsightLeafStorage(): GeoinsightLeafStorage {
  let stored: { areaId: number; feature: TerritoryMapFeature } | null = null
  return {
    store(areaId, feature) {
      stored = { areaId, feature }
    },
    get(areaId) {
      return stored?.areaId === areaId ? stored.feature : null
    },
    clear() {
      stored = null
    },
  }
}
