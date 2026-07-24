/**
 * Tracks Geoinsight geom_id ↔ territory feature metadata for click navigation.
 */
import type { TerritoryMapFeature } from '@/features/territory/types/mapFeature'
import { toTerritoryMapFeature } from '@/features/territory/lib/featureIdentity'

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
}
