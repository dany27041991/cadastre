import { describe, expect, it } from 'vitest'
import { serverViewportCollectionToDisplayItems } from './greenClusterPipeline'

describe('serverViewportCollectionToDisplayItems', () => {
  it('maps server clusters and raw assets to display items', () => {
    const collection = {
      type: 'FeatureCollection' as const,
      features: [
        {
          type: 'Feature' as const,
          id: 10,
          properties: {
            id: 10,
            cluster: true,
            cluster_count: 42,
            cluster_key: '123,456',
            cluster_bbox: [12.0, 42.0, 12.1, 42.1],
          },
          geometry: { type: 'Point', coordinates: [12.05, 42.05] },
        },
        {
          type: 'Feature' as const,
          id: 7,
          properties: { id: 7, geometry_type: 'P' },
          geometry: { type: 'Point', coordinates: [12.2, 42.2] },
        },
      ],
    }
    const items = serverViewportCollectionToDisplayItems(collection)

    expect(items).toHaveLength(2)
    const cluster = items.find((item) => item.isCluster)
    expect(cluster?.memberCount).toBe(42)
    expect(cluster?.clusterKey).toBe('123,456')
    expect(cluster?.bbox).toEqual([12.0, 42.0, 12.1, 42.1])
    const single = items.find((item) => !item.isCluster)
    expect(single?.id).toBe(7)
  })

  it('returns empty for an empty collection', () => {
    expect(
      serverViewportCollectionToDisplayItems({ type: 'FeatureCollection', features: [] })
    ).toHaveLength(0)
  })
})
