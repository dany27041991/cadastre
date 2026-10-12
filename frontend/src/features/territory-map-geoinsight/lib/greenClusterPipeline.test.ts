import { describe, expect, it } from 'vitest'
import { buildGreenClusterLayerPayload } from '../model/greenClusterPipeline'
import type { ClusterDisplayItem } from '@/features/territory/lib/greenAssetClusterCore'
import { GEOM_PREFIX } from '../model/constants'

describe('buildGreenClusterLayerPayload', () => {
  it('applies per-type styling and polygon clusters scaled by zoom', () => {
    const items: ClusterDisplayItem[] = [
      {
        id: -1,
        label: '5',
        properties: { cluster_count: 5 },
        geometry: { type: 'Point', coordinates: [12.5, 41.8] },
        isCluster: true,
        memberCount: 5,
        members: [],
        bbox: [12.5, 41.8, 12.5, 41.8],
      },
      {
        id: -2,
        label: '40',
        properties: { cluster_count: 40 },
        geometry: { type: 'Point', coordinates: [12.6, 41.81] },
        isCluster: true,
        memberCount: 40,
        members: [],
        bbox: [12.6, 41.81, 12.6, 41.81],
      },
      {
        id: 10,
        label: 'Tree',
        properties: { geometry_type: 'P' },
        geometry: { type: 'Point', coordinates: [12.51, 41.81] },
        isCluster: false,
        memberCount: 1,
        members: [],
        bbox: [12.51, 41.81, 12.51, 41.81],
      },
    ]

    const { geometries, showClusterCountLabels } = buildGreenClusterLayerPayload(items, 10)
    expect(showClusterCountLabels).toBe(true)
    expect(geometries).toHaveLength(5)
    expect(geometries[0]?.geom_id).toBe(`${GEOM_PREFIX.cluster}10_0`)
    expect(geometries[0]?.color).toBe('#38bdf8')
    expect(geometries[0]?.data).toMatch(/^POLYGON/i)
    expect(geometries[1]?.geom_id).toBe(`5\u200B${GEOM_PREFIX.cluster}10_0`)
    expect(geometries[1]?.data).toMatch(/^POINT/i)
    expect(geometries[2]?.data).toMatch(/^POLYGON/i)
    expect(geometries[2]?.data!.length).toBeGreaterThan(geometries[0]?.data!.length ?? 0)
    expect(geometries[4]?.color).toBe('#15803d')
  })

  it('uses stable GC_ geom ids for clusters', () => {
    const items: ClusterDisplayItem[] = [
      {
        id: -1,
        label: '5',
        properties: {},
        geometry: { type: 'Point', coordinates: [12.5, 41.8] },
        isCluster: true,
        memberCount: 5,
        members: [],
        bbox: null,
      },
      {
        id: -2,
        label: '12',
        properties: {},
        geometry: { type: 'Point', coordinates: [12.6, 41.81] },
        isCluster: true,
        memberCount: 12,
        members: [],
        bbox: null,
      },
    ]

    const { geometries, showClusterCountLabels } = buildGreenClusterLayerPayload(items, 11)
    expect(showClusterCountLabels).toBe(true)
    expect(geometries).toHaveLength(4)
    expect(geometries[0]?.geom_id).toBe(`${GEOM_PREFIX.cluster}11_0`)
    expect(geometries[1]?.geom_id).toBe(`5\u200B${GEOM_PREFIX.cluster}11_0`)
    expect(geometries[2]?.geom_id).toBe(`${GEOM_PREFIX.cluster}11_1`)
    expect(geometries[3]?.geom_id).toBe(`12\u200B${GEOM_PREFIX.cluster}11_1`)
  })
})
