import { describe, expect, it } from 'vitest'
import type { ClusterDisplayItem } from '@/features/territory/lib/greenAssetClusterCore'
import {
  buildGreenAssetGeometryClip,
  classifyGreenAssetDisplay,
  GREEN_CLUSTER_FILL,
  shouldShowClusterCountLabels,
} from './greenAssetMapStyle'

function item(partial: Partial<ClusterDisplayItem> & Pick<ClusterDisplayItem, 'geometry'>): ClusterDisplayItem {
  return {
    id: 1,
    label: 'x',
    properties: {},
    isCluster: false,
    memberCount: 1,
    members: [],
    bbox: null,
    ...partial,
  }
}

describe('classifyGreenAssetDisplay', () => {
  it('classifies cluster items', () => {
    expect(classifyGreenAssetDisplay(item({ isCluster: true, geometry: { type: 'Point', coordinates: [0, 0] } }))).toBe(
      'cluster'
    )
  })

  it('classifies by geometry_type P/L/S', () => {
    expect(
      classifyGreenAssetDisplay(
        item({ properties: { geometry_type: 'P' }, geometry: { type: 'Point', coordinates: [0, 0] } })
      )
    ).toBe('point')
    expect(
      classifyGreenAssetDisplay(
        item({ properties: { geometry_type: 'S' }, geometry: { type: 'Polygon', coordinates: [[[0, 0], [1, 0], [1, 1], [0, 0]]] } })
      )
    ).toBe('surface')
  })
})

describe('buildGreenAssetGeometryClip', () => {
  it('uses azure hex fill for clusters', () => {
    const clip = buildGreenAssetGeometryClip(
      'GC_10_0',
      'POLYGON((0 0,1 0,1 1,0 0))',
      item({ isCluster: true, memberCount: 20, geometry: { type: 'Point', coordinates: [12, 41] } })
    )
    expect(clip.color).toBe(GREEN_CLUSTER_FILL)
    expect(clip.hide_label).toBe(true)
  })

  it('uses solid hex green for tree points', () => {
    const clip = buildGreenAssetGeometryClip(
      'GS_1',
      'POINT(12 41)',
      item({ properties: { geometry_type: 'P' }, geometry: { type: 'Point', coordinates: [12, 41] } })
    )
    expect(clip.color).toBe('#15803d')
    expect(clip.width).toBe(6)
  })

  it('uses darker hex fill for surface assets', () => {
    const clip = buildGreenAssetGeometryClip(
      'GS_2',
      'POLYGON((0 0,1 0,1 1,0 0))',
      item({
        properties: { geometry_type: 'S' },
        geometry: { type: 'Polygon', coordinates: [[[0, 0], [1, 0], [1, 1], [0, 0]]] },
      })
    )
    expect(clip.color).toBe('#0f7637')
  })
})

describe('shouldShowClusterCountLabels', () => {
  it('is true when at least one multi-member cluster is present', () => {
    expect(
      shouldShowClusterCountLabels([
        item({ isCluster: true, memberCount: 3, geometry: { type: 'Point', coordinates: [0, 0] } }),
        item({ isCluster: false, memberCount: 1, geometry: { type: 'Point', coordinates: [1, 1] } }),
      ])
    ).toBe(true)
    expect(shouldShowClusterCountLabels([])).toBe(false)
  })
})
