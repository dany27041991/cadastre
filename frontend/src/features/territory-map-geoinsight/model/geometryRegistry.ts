/**
 * Tracks Geoinsight geom_id ↔ territory feature metadata for click navigation.
 */
import type { TerritoryMapFeature } from '@/features/territory/types/mapFeature'
import { toTerritoryMapFeature } from '@/features/territory/lib/featureIdentity'
import {
  geometryHitKind,
  hitPadForKind,
  lonLatHitsGeometry,
} from '../lib/geometryHitTest'

export type GeometryLayerKind = 'territory' | 'green_area' | 'green_asset' | 'cluster'

export interface GeometryRegistryEntry {
  id: number
  label: string
  geomId: string
  layerKind: GeometryLayerKind
  bbox: [number, number, number, number] | null
  properties: Record<string, unknown>
  geometry: object
  isCluster?: boolean
  memberCount?: number
  members?: import('@/features/territory/lib/greenAssetClusterCore').ClusterInputFeature[]
}

export class GeometryRegistry {
  private readonly entries = new Map<string, GeometryRegistryEntry>()

  register(entry: GeometryRegistryEntry): void {
    this.entries.set(entry.geomId, entry)
  }

  registerAlias(aliasGeomId: string, canonicalGeomId: string): void {
    const entry = this.entries.get(canonicalGeomId)
    if (entry) this.entries.set(aliasGeomId, entry)
  }

  getByGeomId(geomId: string): GeometryRegistryEntry | undefined {
    return this.entries.get(geomId)
  }

  /** Resolves bare numeric ids and prefers green layers over territory when ambiguous. */
  resolveGeomId(geomId: string): GeometryRegistryEntry | undefined {
    const direct = this.entries.get(geomId)
    if (direct) return direct

    if (!/^\d+$/.test(geomId)) return undefined

    const prefixOrder = ['GC_', 'GA_', 'GS_', 'T_'] as const
    for (const prefix of prefixOrder) {
      const entry = this.entries.get(`${prefix}${geomId}`)
      if (entry) return entry
    }
    return undefined
  }

  getIdsByPrefix(prefix: string): string[] {
    return [...this.entries.keys()].filter((id) => id.startsWith(prefix))
  }

  getGeomIdsByLayerKind(layerKind: GeometryLayerKind): string[] {
    // Include alias keys (cluster-count labels: "12\u200BGC_…") so vendor removes
    // drop every mounted geom for that layer, not only the canonical GC_ id.
    return [...this.entries.entries()]
      .filter(([, entry]) => entry.layerKind === layerKind)
      .map(([key]) => key)
  }

  removeByPrefix(prefix: string): string[] {
    return this.removeEntries((key, entry) => key.startsWith(prefix) || entry.geomId.startsWith(prefix))
  }

  removeByLayerKind(layerKind: GeometryLayerKind): string[] {
    return this.removeEntries((_key, entry) => entry.layerKind === layerKind)
  }

  /**
   * Removes matching entries including their alias keys. Aliases point to the
   * same entry object; leaving them behind made removeByLayerKind return the
   * same geomIds forever (phantom vendor removes on every zoom transition).
   */
  private removeEntries(
    matches: (key: string, entry: GeometryRegistryEntry) => boolean
  ): string[] {
    const removed = new Set<GeometryRegistryEntry>()
    for (const [key, entry] of this.entries) {
      if (matches(key, entry)) removed.add(entry)
    }
    if (removed.size === 0) return []
    const ids = new Set<string>()
    for (const [key, entry] of this.entries) {
      if (removed.has(entry)) {
        // Return every map key (canonical + aliases) so removeGeomIds also
        // clears cluster-count label helpers mounted under non-prefix ids.
        ids.add(key)
        ids.add(entry.geomId)
        this.entries.delete(key)
      }
    }
    return [...ids]
  }

  removeByGeomId(geomId: string): boolean {
    return this.entries.delete(geomId)
  }

  removeAll(): string[] {
    const ids = [...this.entries.keys()]
    this.entries.clear()
    return ids
  }

  getTerritoryBboxes(): Array<[number, number, number, number] | null> {
    return [...this.entries.values()]
      .filter((e) => e.layerKind === 'territory')
      .map((e) => e.bbox)
  }

  getGreenBboxes(): Array<[number, number, number, number] | null> {
    return [...this.entries.values()]
      .filter(
        (e) =>
          e.layerKind === 'green_area' ||
          e.layerKind === 'green_asset' ||
          e.layerKind === 'cluster'
      )
      .map((e) => e.bbox)
  }

  toMapFeature(entry: GeometryRegistryEntry): TerritoryMapFeature {
    return toTerritoryMapFeature(entry.id, entry.properties, entry.geometry)
  }

  /**
   * Hit-test green area/asset under lon/lat (EPSG:4326).
   * Coarse bbox filter, then geometry (Point / Line / Polygon + Multi*).
   * Prefers green_asset over green_area; skips multi-member clusters.
   */
  findGreenHoverTarget(lon: number, lat: number): GeometryRegistryEntry | null {
    let bestAsset: GeometryRegistryEntry | null = null
    let bestArea: GeometryRegistryEntry | null = null
    let bestAssetArea = Number.POSITIVE_INFINITY
    let bestAreaArea = Number.POSITIVE_INFINITY

    const seen = new Set<GeometryRegistryEntry>()
    for (const entry of this.entries.values()) {
      if (seen.has(entry)) continue
      seen.add(entry)
      if (entry.layerKind !== 'green_area' && entry.layerKind !== 'green_asset') continue
      if (entry.isCluster && (entry.memberCount ?? 0) > 1) continue
      const bbox = entry.bbox
      if (!bbox) continue

      const kind = geometryHitKind(entry.geometry)
      const pad = hitPadForKind(kind === 'unknown' ? 'surface' : kind)
      const [minLon, minLat, maxLon, maxLat] = bbox
      const inBbox =
        lon >= minLon - pad &&
        lon <= maxLon + pad &&
        lat >= minLat - pad &&
        lat <= maxLat + pad
      if (!inBbox) continue

      const hasGeometry =
        entry.geometry != null &&
        typeof entry.geometry === 'object' &&
        'type' in entry.geometry
      if (hasGeometry && !lonLatHitsGeometry(entry.geometry, lon, lat, pad)) continue

      const area = Math.max(maxLon - minLon, pad) * Math.max(maxLat - minLat, pad)
      if (entry.layerKind === 'green_asset') {
        if (area < bestAssetArea) {
          bestAsset = entry
          bestAssetArea = area
        }
      } else if (area < bestAreaArea) {
        bestArea = entry
        bestAreaArea = area
      }
    }
    return bestAsset ?? bestArea
  }
}
