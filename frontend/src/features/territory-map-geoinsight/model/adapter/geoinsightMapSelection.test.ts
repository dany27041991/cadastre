import { describe, expect, it, vi } from 'vitest'
import { GeometryRegistry } from '../geometryRegistry'
import { selectByGeomId } from './geoinsightMapSelection'
import type { GeoinsightAdapterHost } from './geoinsightAdapterHost'

function makeHost(overrides: Partial<GeoinsightAdapterHost> = {}): GeoinsightAdapterHost {
  const registry = new GeometryRegistry()
  const onFeatureSelect = vi.fn()
  const onGreenDetailSelect = vi.fn()
  return {
    registry,
    onFeatureSelectRef: { current: onFeatureSelect },
    onGreenDetailSelectRef: { current: onGreenDetailSelect },
    isClickNavigationEnabledRef: { current: () => true },
    drillExcludeAreaIds: [],
    lastTerritoryGeometries: [],
    lastTerritoryFitBbox: null,
    lastGreenGeometries: [],
    greenLayerVisible: true,
    pending: [],
    removeGeomIds: vi.fn(),
    addGeometries: vi.fn(),
    ...overrides,
  } as unknown as GeoinsightAdapterHost
}

describe('selectByGeomId', () => {
  it('opens green detail for assets without feature-select navigation', () => {
    const host = makeHost()
    host.registry.register({
      id: 9,
      label: 'Tree',
      geomId: 'GS_9',
      layerKind: 'green_asset',
      bbox: [12.5, 41.9, 12.5, 41.9],
      properties: { species: 'Ulivo' },
      geometry: { type: 'Point', coordinates: [12.5, 41.9] },
    })

    selectByGeomId(host, 'GS_9')

    expect(host.onGreenDetailSelectRef.current).toHaveBeenCalledWith(
      9,
      'Tree',
      expect.objectContaining({ id: 9 }),
      'green_asset'
    )
    expect(host.onFeatureSelectRef.current).not.toHaveBeenCalled()
  })

  it('opens green detail for areas without zoom/navigation', () => {
    const host = makeHost()
    host.registry.register({
      id: 2,
      label: 'Parco',
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

    selectByGeomId(host, 'GA_2')

    expect(host.onGreenDetailSelectRef.current).toHaveBeenCalledWith(
      2,
      'Parco',
      expect.objectContaining({ id: 2 }),
      'green_area'
    )
    expect(host.onFeatureSelectRef.current).not.toHaveBeenCalled()
  })

  it('still navigates territory when click navigation is enabled', () => {
    const host = makeHost()
    host.registry.register({
      id: 1,
      label: 'Roma',
      geomId: 'T_1',
      layerKind: 'territory',
      bbox: [12, 41, 13, 42],
      properties: { name: 'Roma' },
      geometry: {},
    })

    selectByGeomId(host, 'T_1')

    expect(host.onFeatureSelectRef.current).toHaveBeenCalledWith(
      1,
      'Roma',
      expect.objectContaining({ id: 1 }),
      'territory'
    )
    expect(host.onGreenDetailSelectRef.current).not.toHaveBeenCalled()
  })

  it('freezes territory navigation when click navigation is disabled', () => {
    const host = makeHost({
      isClickNavigationEnabledRef: { current: () => false },
    })
    host.registry.register({
      id: 1,
      label: 'Roma',
      geomId: 'T_1',
      layerKind: 'territory',
      bbox: [12, 41, 13, 42],
      properties: {},
      geometry: {},
    })

    selectByGeomId(host, 'T_1')

    expect(host.onFeatureSelectRef.current).not.toHaveBeenCalled()
    expect(host.onGreenDetailSelectRef.current).not.toHaveBeenCalled()
  })
})
