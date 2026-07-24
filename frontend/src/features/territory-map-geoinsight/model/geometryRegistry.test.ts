import { describe, expect, it } from 'vitest'
import { GeometryRegistry } from './geometryRegistry'

describe('GeometryRegistry', () => {
  it('registers and resolves geom ids by prefix priority', () => {
    const registry = new GeometryRegistry()
    registry.register({
      id: 1,
      label: 'Territory',
      geomId: 'T_1',
      layerKind: 'territory',
      bbox: [0, 0, 1, 1],
      properties: {},
      geometry: {},
    })
    registry.register({
      id: 1,
      label: 'Green area',
      geomId: 'GA_1',
      layerKind: 'green_area',
      bbox: [0, 0, 1, 1],
      properties: {},
      geometry: {},
    })

    expect(registry.resolveGeomId('1')?.geomId).toBe('GA_1')
    expect(registry.getByGeomId('T_1')?.layerKind).toBe('territory')
  })

  it('removes entries by prefix', () => {
    const registry = new GeometryRegistry()
    registry.register({
      id: 10,
      label: 'A',
      geomId: 'GA_10',
      layerKind: 'green_area',
      bbox: null,
      properties: {},
      geometry: {},
    })
    const removed = registry.removeByPrefix('GA_')
    expect(removed).toEqual(['GA_10'])
    expect(registry.getByGeomId('GA_10')).toBeUndefined()
  })

  it('returns cluster-count label aliases when removing by layer kind', () => {
    const registry = new GeometryRegistry()
    registry.register({
      id: 0,
      label: '42',
      geomId: 'GC_10_cell',
      layerKind: 'cluster',
      bbox: null,
      properties: {},
      geometry: {},
      isCluster: true,
      memberCount: 42,
    })
    const labelAlias = `42\u200BGC_10_cell`
    registry.registerAlias(labelAlias, 'GC_10_cell')

    const removed = registry.removeByLayerKind('cluster')
    expect(removed).toEqual(expect.arrayContaining(['GC_10_cell', labelAlias]))
    expect(registry.getByGeomId('GC_10_cell')).toBeUndefined()
    expect(registry.getByGeomId(labelAlias)).toBeUndefined()
    expect(registry.getGeomIdsByLayerKind('cluster')).toEqual([])
  })
})
