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

  it('finds green hover target preferring assets over areas', () => {
    const registry = new GeometryRegistry()
    registry.register({
      id: 2,
      label: 'Area',
      geomId: 'GA_2',
      layerKind: 'green_area',
      bbox: [12, 41, 13, 42],
      properties: { name: 'Parco' },
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [12, 41],
            [13, 41],
            [13, 42],
            [12, 42],
            [12, 41],
          ],
        ],
      },
    })
    registry.register({
      id: 9,
      label: 'Tree',
      geomId: 'GS_9',
      layerKind: 'green_asset',
      bbox: [12.4, 41.4, 12.6, 41.6],
      properties: { species: 'Ulivo', geometry_type: 'P' },
      geometry: { type: 'Point', coordinates: [12.5, 41.5] },
    })
    registry.register({
      id: 0,
      label: 'Cluster',
      geomId: 'GC_1',
      layerKind: 'cluster',
      bbox: [12.4, 41.4, 12.6, 41.6],
      properties: {},
      geometry: {},
      isCluster: true,
      memberCount: 5,
    })

    expect(registry.findGreenHoverTarget(12.5, 41.5)?.geomId).toBe('GS_9')
    expect(registry.findGreenHoverTarget(12.2, 41.2)?.geomId).toBe('GA_2')
    expect(registry.findGreenHoverTarget(0, 0)).toBeNull()
  })

  it('hits point, line and polygon assets by geometry (not bbox alone)', () => {
    const registry = new GeometryRegistry()
    registry.register({
      id: 1,
      label: 'Point',
      geomId: 'GS_1',
      layerKind: 'green_asset',
      bbox: [12.5, 41.9, 12.5, 41.9],
      properties: { geometry_type: 'P' },
      geometry: { type: 'Point', coordinates: [12.5, 41.9] },
    })
    registry.register({
      id: 2,
      label: 'Line',
      geomId: 'GS_2',
      layerKind: 'green_asset',
      bbox: [12.0, 42.0, 12.3, 42.0],
      properties: { geometry_type: 'L' },
      geometry: {
        type: 'LineString',
        coordinates: [
          [12.0, 42.0],
          [12.3, 42.0],
        ],
      },
    })
    registry.register({
      id: 3,
      label: 'Surface',
      geomId: 'GS_3',
      layerKind: 'green_asset',
      bbox: [13.0, 43.0, 13.4, 43.4],
      properties: { geometry_type: 'S' },
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [13.0, 43.0],
            [13.4, 43.0],
            [13.4, 43.4],
            [13.0, 43.4],
            [13.0, 43.0],
          ],
        ],
      },
    })

    expect(registry.findGreenHoverTarget(12.5005, 41.9005)?.geomId).toBe('GS_1')
    expect(registry.findGreenHoverTarget(12.15, 42.0)?.geomId).toBe('GS_2')
    // Inside bbox of surface but outside the polygon ring → miss
    expect(registry.findGreenHoverTarget(13.5, 43.2)).toBeNull()
    expect(registry.findGreenHoverTarget(13.2, 43.2)?.geomId).toBe('GS_3')
  })
})
